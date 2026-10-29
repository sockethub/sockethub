import { getPlatformId } from "@sockethub/util/crypto";
import type { IInitObject } from "./bootstrap/init.js";
import config from "./config.js";
import {
    type ConnectionScope,
    rememberAnonymousScope,
    resolveConnectionScope,
} from "./connection-scope.js";
import PlatformInstance, {
    type PlatformInstanceParams,
    platformInstances,
} from "./platform-instance.js";
import type { MessageToPlatformChild } from "./platform-ipc.js";

class ProcessManager {
    private readonly parentId: string;
    private readonly parentSecret1: string;
    private readonly parentSecret2: string;
    private init: IInitObject;
    // per-identifier serialization of ensureProcess runs; see ensureProcess()
    private readonly ensureChains = new Map<string, Promise<void>>();

    constructor(
        parentId: string,
        parentSecret1: string,
        parentSecret2: string,
        init: IInitObject,
    ) {
        this.parentId = parentId;
        this.parentSecret1 = parentSecret1;
        this.parentSecret2 = parentSecret2;
        this.init = init;
    }

    /**
     * @param sessionId socket id to register with the instance; absent for HTTP
     * @param credentialSessionId session the credentials were submitted under.
     *   Defaults to `sessionId`; HTTP passes its own single-use session, which
     *   is not a socket and so is never registered.
     */
    async get(
        platform: string,
        actorId: string,
        sessionId?: string,
        sessionIp?: string,
        credentialSessionId?: string,
    ): Promise<PlatformInstance> {
        const platformDetails = this.init.platforms.get(platform);
        // A persistent instance is selected by actor *and* a server-derived
        // scope, so a client-supplied actor id on its own can neither reach
        // another session's connection nor reveal that one exists. Rejects
        // when this session's credentials failed to store.
        const connectionScope = platformDetails.config.persist
            ? await resolveConnectionScope(platform, actorId, {
                  credentialSessionId: credentialSessionId ?? sessionId,
                  socketSessionId: sessionId,
                  sessionIp,
              })
            : undefined;
        const pi = platformDetails.config.persist
            ? // ensure process is started - one for each actor
              await this.ensureProcess(
                  platform,
                  sessionId,
                  actorId,
                  sessionIp,
                  connectionScope,
              )
            : // ensure process is started - one for all jobs
              await this.ensureProcess(platform);
        pi.config = platformDetails.config;
        pi.contextUrl = platformDetails.contextUrl;
        return pi;
    }

    private createPlatformInstance(
        identifier: string,
        platform: string,
        actor?: string,
        scope?: string,
        queueId?: string,
    ): PlatformInstance {
        const secrets: MessageToPlatformChild = [
            "secrets",
            {
                parentSecret1: this.parentSecret1,
                parentSecret2: this.parentSecret2,
            },
        ];
        const platformInstanceConfig: PlatformInstanceParams = {
            identifier: identifier,
            platform: platform,
            parentId: this.parentId,
            parentSecret1: this.parentSecret1,
            actor: actor,
            scope: scope,
            queueId: queueId,
        };
        const platformInstance = new PlatformInstance(platformInstanceConfig);
        platformInstance.initQueue(this.parentSecret1 + this.parentSecret2);
        platformInstance.process.send(secrets);
        return platformInstance;
    }

    /**
     * ensureProcessNow() yields the event loop while awaiting a dead
     * predecessor's teardown, so two concurrent messages for the same
     * identifier could otherwise both find no live instance and each fork
     * a replacement child. Chain runs per identifier so only one is
     * inspecting or creating that identifier's instance at a time.
     */
    private ensureProcess(
        platform: string,
        sessionId?: string,
        actor?: string,
        sessionIp?: string,
        connectionScope?: ConnectionScope,
    ): Promise<PlatformInstance> {
        const identifier = getPlatformId(
            platform,
            actor,
            connectionScope?.scope,
        );
        const prior = this.ensureChains.get(identifier) ?? Promise.resolve();
        const run = prior.then(() =>
            this.ensureProcessNow(
                identifier,
                platform,
                sessionId,
                actor,
                sessionIp,
                connectionScope,
            ),
        );
        // Park a settled (never-rejecting) copy for the next caller, and
        // drop it once the chain drains so the map doesn't grow unboundedly.
        const settled = run.then(
            (): undefined => undefined,
            (): undefined => undefined,
        );
        this.ensureChains.set(identifier, settled);
        settled.then(() => {
            if (this.ensureChains.get(identifier) === settled) {
                this.ensureChains.delete(identifier);
            }
        });
        return run;
    }

    private async ensureProcessNow(
        identifier: string,
        platform: string,
        sessionId?: string,
        actor?: string,
        sessionIp?: string,
        connectionScope?: ConnectionScope,
    ): Promise<PlatformInstance> {
        const existing = platformInstances.get(identifier);
        const reusable = existing && this.isProcessAlive(existing);
        this.assertInstanceCapacity(
            platform,
            identifier,
            actor === undefined,
            sessionId,
            sessionIp,
            !!reusable,
        );
        let inheritedQueueId: string | undefined;
        if (existing && !reusable) {
            // The replacement created below shares `identifier` and the Redis
            // queue name the dead instance was using. Mark the dead instance as
            // replaced *before* teardown so a teardown started here leaves the
            // shared queue's jobs intact (#1166), and *await* the teardown so
            // one already in flight — a crash-close teardown pauses and
            // obliterates the queue — finishes before the replacement's queue
            // exists to be damaged by it.
            inheritedQueueId = existing.queueId;
            existing.markReplaced();
            await existing.shutdown();
            // Teardown yields; other identifiers may have consumed capacity meanwhile.
            this.assertInstanceCapacity(
                platform,
                identifier,
                actor === undefined,
                sessionId,
                sessionIp,
                !!reusable,
            );
        }
        const platformInstance = reusable
            ? existing
            : this.createPlatformInstance(
                  identifier,
                  platform,
                  actor,
                  connectionScope?.scope,
                  inheritedQueueId,
              );
        if (sessionIp && !platformInstance.global) {
            platformInstance.ownerIps.add(sessionIp);
        }
        if (sessionId) {
            platformInstance.registerSession(sessionId, sessionIp);
        }
        platformInstances.set(identifier, platformInstance);
        // Session-derived scopes are recorded against the instance so a page
        // refresh can reclaim this connection. Cleared in
        // PlatformInstance.shutdown(), so it can never outlive the worker.
        if (connectionScope?.resumption && sessionId) {
            rememberAnonymousScope(
                connectionScope.resumption,
                connectionScope.scope,
                identifier,
                sessionId,
            );
        }
        return platformInstance;
    }

    /** Stateless workers are bounded by the enabled platform count, independently
     * of client occupancy. Check owners even when attaching to a shared worker.
     */
    private assertInstanceCapacity(
        platform: string,
        identifier: string,
        global: boolean,
        sessionId?: string,
        sessionIp?: string,
        reusable = false,
    ): void {
        if (global) return;
        const others = [...platformInstances.values()].filter(
            (pi) => pi.id !== identifier && !pi.global,
        );
        const max = Number(config.get("limits:maxPlatformInstances") ?? 0);
        if (!reusable && max > 0 && others.length >= max) {
            throw new Error(
                `platform instance limit reached (${max}); cannot start new ${platform} instance`,
            );
        }
        const perSession = Number(
            config.get("limits:maxInstancesPerSession") ?? 0,
        );
        if (
            perSession > 0 &&
            sessionId &&
            others.filter((pi) => pi.sessions.has(sessionId)).length >=
                perSession
        ) {
            throw new Error(
                `per-session platform instance limit reached (${perSession})`,
            );
        }
        const perIp = Number(config.get("limits:maxInstancesPerIp") ?? 0);
        if (
            perIp > 0 &&
            sessionIp &&
            others.filter((pi) => pi.ownerIps.has(sessionIp)).length >= perIp
        ) {
            throw new Error(
                `per-address platform instance limit reached (${perIp})`,
            );
        }
    }

    private isProcessAlive(platformInstance: PlatformInstance): boolean {
        const pid = platformInstance.process?.pid;
        if (!pid) {
            return false;
        }
        if (platformInstance.process.exitCode !== null) {
            return false;
        }
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err && err.code === "EPERM") {
                return true;
            }
            return false;
        }
    }
}

export default ProcessManager;
