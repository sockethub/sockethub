import { getPlatformId } from "@sockethub/util/crypto";
import type { IInitObject } from "./bootstrap/init.js";
import config from "./config.js";
import {
    type ConnectionScope,
    rememberAnonymousScope,
    resolveConnectionScope,
} from "./connection-scope.js";
import PlatformInstance, {
    type MessageFromParent,
    type PlatformInstanceParams,
    platformInstances,
} from "./platform-instance.js";

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
    ): PlatformInstance {
        const secrets: MessageFromParent = [
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
            actor: actor,
            scope: scope,
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
        if (!reusable) {
            this.assertInstanceCapacity(platform, identifier);
        }
        if (existing && !reusable) {
            // The replacement created below shares `identifier` and the Redis
            // queue name derived from it. Mark the dead instance as replaced
            // *before* teardown so a teardown started here leaves the shared
            // queue's jobs intact (#1166), and *await* the teardown so one
            // already in flight — a crash-close teardown pauses and
            // obliterates the queue — finishes before the replacement's
            // queue exists to be damaged by it.
            existing.markReplaced();
            await existing.shutdown();
        }
        const platformInstance = reusable
            ? existing
            : this.createPlatformInstance(
                  identifier,
                  platform,
                  actor,
                  connectionScope?.scope,
              );
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

    /**
     * Each platform instance forks a full child process; without an upper
     * bound, a public instance can be driven into resource exhaustion.
     * Throws when the configured cap (`limits.maxPlatformInstances`, 0 =
     * disabled) has been reached and a new instance would be created.
     *
     * `identifier`'s existing (dead) slot, if any, is excluded from the
     * count: replacing a crashed instance for the same actor doesn't
     * increase the total instance count, so it shouldn't be blocked by
     * the cap.
     */
    private assertInstanceCapacity(platform: string, identifier: string): void {
        const max = Number(config.get("limits:maxPlatformInstances") ?? 0);
        if (!Number.isFinite(max) || max <= 0) {
            return;
        }
        const occupied = platformInstances.has(identifier)
            ? platformInstances.size - 1
            : platformInstances.size;
        if (occupied >= max) {
            throw new Error(
                `platform instance limit reached (${max}); cannot start new ${platform} instance`,
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
