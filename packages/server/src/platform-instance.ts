import { type ChildProcess, fork } from "node:child_process";
import { join } from "node:path";

import {
    CredentialsStore,
    type JobDataDecrypted,
    JobQueue,
} from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import type {
    ActivityStream,
    CompletedJobHandler,
    CredentialsObject,
    InternalActivityStream,
    Logger,
    PlatformConfig,
} from "@sockethub/schemas";
import {
    buildCanonicalContext,
    INTERNAL_PLATFORM_CONTEXT_URL,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
import { crypto } from "@sockethub/util/crypto";
import { errorMessage } from "@sockethub/util/error";
import config from "./config.js";
import {
    forgetAnonymousScopes,
    reassignAnonymousScopes,
    reassignPendingScopes,
} from "./connection-scope.js";
import { getSocket } from "./listener.js";
import {
    derivePlatformCredentialsSecret,
    migrateRenamedActorCredentials,
    renameActorCredentialsInStore,
} from "./platform.js";
import { type SentryConfig, serializeSentryConfig } from "./sentry-config.js";
import { __dirname } from "./util.js";

// collection of platform instances, stored by `id`
export const platformInstances = new Map<string, PlatformInstance>();

export interface PlatformInstanceParams {
    identifier: string;
    platform: string;
    parentId?: string;
    parentSecret1?: string;
    actor?: string;
    /**
     * Reuse an existing worker's Redis queue when replacing a dead instance
     * for the same routing identifier (#1166). Omitted for brand-new workers.
     */
    queueId?: string;
    /**
     * Server-derived value mixed into `identifier`. Forwarded to the child so
     * it derives the same identifier when it re-keys on an actor change.
     */
    scope?: string;
}

type EnvFormat = {
    LOG_LEVEL?: string;
    REDIS_URL: string;
    SOCKETHUB_CREDENTIALS_TTL_MS?: string;
    SOCKETHUB_PLATFORM_CHILD?: string;
    SOCKETHUB_PLATFORM_CONFIG?: string;
    SOCKETHUB_PLATFORM_SCOPE?: string;
    SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS?: string;
    SOCKETHUB_PLATFORM_HEARTBEAT_TIMEOUT_MS?: string;
    SOCKETHUB_QUEUE_INSTANCE_ID?: string;
    SOCKETHUB_SENTRY_CONFIG?: string;
};

type MessageFromPlatform =
    | [
          "updateActor",
          string | null | undefined,
          string,
          CredentialsObject?,
          string?,
          boolean?,
      ]
    | ["sessionUnauthorized", null | undefined, string]
    | ["error", string]
    | ["heartbeat", ActivityStream]
    | [string, ActivityStream, string?];

export type MessageToPlatformChild =
    | ["secrets", { parentSecret1: string; parentSecret2: string }]
    | ["updateActorAck"]
    | ["updateActorFailed", string];

export interface MessageFromParent extends Array<string | unknown> {
    0: string;
    1: unknown;
}

// Handlers for jobs that never complete are pruned after this long. Matches
// the queue's removeOnComplete/removeOnFail age (300s) plus slack.
const JOB_HANDLER_TTL_MS = 6 * 60 * 1000;

const HEARTBEAT_INTERVAL_MS = Number(
    config.get("platformHeartbeat:intervalMs") ?? 5000,
);
const HEARTBEAT_TIMEOUT_MS = Number(
    config.get("platformHeartbeat:timeoutMs") ?? 15000,
);

export default class PlatformInstance {
    id: string;
    /**
     * Immutable Redis queue name for this worker. Distinct from `id`, which
     * moves when the actor is renamed and can be reused by a later connection.
     */
    readonly queueId: string;
    flaggedForTermination = false;
    queue: JobQueue;
    JobQueue: typeof JobQueue;
    getSocket: typeof getSocket;
    readonly global: boolean = false;
    readonly completedJobHandlers: Map<string, CompletedJobHandler> = new Map();
    private readonly completedJobHandlerTimestamps: Map<string, number> =
        new Map();
    config: PlatformConfig;
    contextUrl?: string;
    private initialized = false;
    readonly name: string;
    process: ChildProcess;
    readonly log: Logger;
    readonly parentId: string;
    private readonly parentSecret1?: string;
    readonly sessions: Set<string> = new Set();
    readonly sessionIps: Map<string, string> = new Map();
    private readonly sessionSecrets: Map<string, string> = new Map();
    private processMessageListener?: (message: MessageFromPlatform) => void;
    private processCloseListener?: (e: unknown) => void;
    private heartbeatLastSeen = Date.now();
    private heartbeatMonitor?: NodeJS.Timeout;
    private heartbeatListener?: (message: MessageFromPlatform) => void;
    private heartbeatFailureHandled = false;
    private replaced = false;
    private shutdownResult?: Promise<void>;
    /**
     * Actor this instance was opened for. Updated when the platform re-keys
     * (IRC nick change) so a later rename moves the credential scope off the
     * actor the client is using now, not the one from process start.
     */
    private actor?: string;

    constructor(params: PlatformInstanceParams) {
        this.id = params.identifier;
        this.queueId = params.queueId ?? crypto.randId(16);
        this.name = params.platform;
        this.parentId = params.parentId;
        this.parentSecret1 = params.parentSecret1;
        if (params.actor) {
            this.actor = params.actor;
        } else {
            this.global = true;
        }

        this.log = createLogger(`server:platform-instance:${this.id}`);
        const env: EnvFormat = {
            REDIS_URL: config.get("redis:url") as string,
            SOCKETHUB_PLATFORM_CHILD: "1",
            SOCKETHUB_QUEUE_INSTANCE_ID: this.queueId,
        };
        if (params.scope) {
            env.SOCKETHUB_PLATFORM_SCOPE = params.scope;
        }
        if (process.env.LOG_LEVEL) {
            env.LOG_LEVEL = process.env.LOG_LEVEL;
        }
        // Forward the credential-key TTL so the child's per-job reads refresh
        // the sliding expiry the parent set on save.
        const credentialsTtl = config.get("credentials:ttlMs");
        if (typeof credentialsTtl !== "undefined") {
            env.SOCKETHUB_CREDENTIALS_TTL_MS = String(credentialsTtl);
        }
        const heartbeatInterval = config.get("platformHeartbeat:intervalMs");
        if (typeof heartbeatInterval !== "undefined") {
            env.SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS =
                String(heartbeatInterval);
        }
        const heartbeatTimeout = config.get("platformHeartbeat:timeoutMs");
        if (typeof heartbeatTimeout !== "undefined") {
            env.SOCKETHUB_PLATFORM_HEARTBEAT_TIMEOUT_MS =
                String(heartbeatTimeout);
        }
        // Forward the parent's resolved Sentry settings. Without this a worker
        // sees no DSN (it is not in the forked environment, and the worker gets
        // no --config either), so its errors are logged and dropped.
        const sentryConfig = this.resolveSentryEnv();
        if (sentryConfig) {
            env.SOCKETHUB_SENTRY_CONFIG = sentryConfig;
        }
        // Forward this platform's `packageConfig` entry (keyed by package name)
        // to the forked child, which merges it onto the platform's defaults.
        const packageConfig = config.get("packageConfig") as
            | Record<string, unknown>
            | undefined;
        const platformConfig =
            packageConfig?.[`@sockethub/platform-${this.name}`];
        if (
            platformConfig &&
            typeof platformConfig === "object" &&
            !Array.isArray(platformConfig) &&
            Object.keys(platformConfig).length > 0
        ) {
            env.SOCKETHUB_PLATFORM_CONFIG = JSON.stringify(platformConfig);
        }

        this.createQueue();
        this.initProcess(this.parentId, this.name, this.id, env);
        this.attachProcessListeners();
        this.startHeartbeatMonitor();
        this.createGetSocket();
    }

    createQueue() {
        this.JobQueue = JobQueue;
    }

    // Separate method to help with testing
    resolveSentryEnv(): string | undefined {
        return serializeSentryConfig(config.get("sentry") as SentryConfig);
    }

    initProcess(parentId: string, name: string, id: string, env: EnvFormat) {
        // spin off a process
        this.process = fork(
            join(__dirname, "platform.js"),
            [parentId, name, id],
            {
                env: env,
            },
        );
    }

    createGetSocket() {
        this.getSocket = getSocket;
    }

    /**
     * Returns whether the platform instance is initialized and ready to handle jobs.
     */
    public isInitialized(): boolean {
        return this.initialized;
    }

    /**
     * Marks this instance as superseded by a replacement that shares its
     * identifier — and therefore its Redis queue name and platformInstances
     * slot. shutdown() on a replaced instance must leave those shared
     * resources alone: pausing/obliterating the queue would destroy the
     * replacement's pending jobs, and deleting the map entry would evict
     * the replacement, causing duplicate child processes (#1166).
     */
    public markReplaced() {
        this.replaced = true;
        this.flaggedForTermination = true;
    }

    /**
     * Destroys all references to this platform instance, internal listeners and controlled processes.
     *
     * Single-flight: every caller shares one teardown run. A crash-close
     * teardown pauses and obliterates the Redis queue asynchronously, so a
     * caller about to create a replacement (ProcessManager.ensureProcess)
     * must be able to await the teardown *already in flight* — a second,
     * independent run would resolve while the first is still obliterating
     * the queue name the replacement is about to reuse.
     */
    public shutdown(): Promise<void> {
        if (!this.shutdownResult) {
            this.shutdownResult = this.teardown();
        }
        return this.shutdownResult;
    }

    private async teardown() {
        this.log.debug("platform process shutdown");
        this.flaggedForTermination = true;
        // Any session-derived scope pointing here dies with the connection, so
        // a later session can never inherit a scope whose worker is gone.
        forgetAnonymousScopes(this.id);
        try {
            if (this.heartbeatMonitor) {
                clearInterval(this.heartbeatMonitor);
                this.heartbeatMonitor = undefined;
            }
            if (this.heartbeatListener) {
                this.process.removeListener("message", this.heartbeatListener);
                this.heartbeatListener = undefined;
            }
            if (this.processMessageListener) {
                this.process.removeListener(
                    "message",
                    this.processMessageListener,
                );
                this.processMessageListener = undefined;
            }
            if (this.processCloseListener) {
                this.process.removeListener("close", this.processCloseListener);
                this.processCloseListener = undefined;
            }
            this.process.removeAllListeners("close");
            this.process.unref();
            this.process.kill();
        } catch (_e) {
            // needs to happen
        }

        try {
            if (this.replaced || platformInstances.get(this.id) !== this) {
                // A replacement instance shares this queue's Redis name;
                // pausing or obliterating it would destroy the replacement's
                // pending jobs. Close our connections only.
                await this.queue.disconnect();
            } else {
                await this.queue.shutdown();
            }
            this.queue = undefined;
        } catch (_e) {
            // this needs to happen
        }

        try {
            // Guard against evicting a replacement instance that has taken
            // over this identifier since our teardown began.
            if (platformInstances.get(this.id) === this) {
                platformInstances.delete(this.id);
            }
        } catch (_e) {
            // this needs to happen
        }
    }

    /**
     * When jobs are completed or failed, we prepare the results and send them to the client socket
     */
    public initQueue(secret: string) {
        this.queue = new this.JobQueue(
            this.parentId,
            this.queueId,
            secret,
            config.get("redis"),
        );

        this.queue.on(
            "completed",
            async (
                job: JobDataDecrypted,
                result: ActivityStream | undefined,
            ) => {
                await this.handleJobResult("completed", job, result);
            },
        );

        this.queue.on(
            "failed",
            async (
                job: JobDataDecrypted,
                result: ActivityStream | undefined,
            ) => {
                await this.handleJobResult("failed", job, result);
            },
        );
    }

    /**
     * Register a handler to be invoked when the job with the given title
     * completes or fails. Entries are pruned after JOB_HANDLER_TTL_MS so
     * jobs that never produce a result (e.g. the platform process dies
     * mid-job) don't leak handlers for the lifetime of the instance.
     */
    public registerCompletedJobHandler(
        title: string,
        handler: CompletedJobHandler,
    ) {
        this.pruneExpiredJobHandlers();
        this.completedJobHandlers.set(title, handler);
        this.completedJobHandlerTimestamps.set(title, Date.now());
    }

    private takeCompletedJobHandler(
        title: string,
    ): CompletedJobHandler | undefined {
        const handler = this.completedJobHandlers.get(title);
        if (handler) {
            this.completedJobHandlers.delete(title);
            this.completedJobHandlerTimestamps.delete(title);
        }
        return handler;
    }

    private pruneExpiredJobHandlers() {
        const cutoff = Date.now() - JOB_HANDLER_TTL_MS;
        for (const [title, registeredAt] of this
            .completedJobHandlerTimestamps) {
            if (registeredAt < cutoff) {
                this.log.debug(
                    `pruning expired completed-job handler ${title}`,
                );
                this.completedJobHandlers.delete(title);
                this.completedJobHandlerTimestamps.delete(title);
            }
        }
    }

    /**
     * Register listener to be called when the process emits a message.
     * @param sessionId ID of socket connection that will receive messages from platform emits
     */
    public registerSession(sessionId: string, clientIp?: string) {
        if (clientIp) {
            this.sessionIps.set(sessionId, clientIp);
        }
        this.sessions.add(sessionId);
    }

    /**
     * Records the per-session secret used to derive that session's credential
     * store. Required so an actor rename can persist the renamed credentials
     * for every session sharing this connection, not only the one that issued
     * the nick change.
     */
    public rememberSessionSecret(sessionId: string, sessionSecret: string) {
        if (!sessionId || !sessionSecret) {
            return;
        }
        this.sessionSecrets.set(sessionId, sessionSecret);
    }

    /**
     * Stop delivering this instance's messages to a session. Used when the
     * session loses (or never had) the right to be attached; the janitor
     * separately drops sessions whose sockets have gone away.
     */
    public deregisterSession(sessionId: string) {
        if (!this.sessions.delete(sessionId)) {
            return;
        }
        this.sessionIps.delete(sessionId);
        this.sessionSecrets.delete(sessionId);
        this.log.debug(`deregistered session ${sessionId}`);
    }

    /**
     * Sends a message to client (user), can be registered with an event emitted from the platform
     * process.
     * @param sessionId ID of the socket connection to send the message to
     * @param msg ActivityStream object to send to client
     */
    public sendToClient(sessionId: string, msg: InternalActivityStream) {
        const socket = this.getSocket(sessionId);
        if (!socket) {
            // Socket not connected (e.g. mid page-refresh, within the janitor
            // grace window). Nothing to deliver to right now; skip quietly. The
            // session/reconnect lifecycle is the janitor's job.
            this.log.debug(
                `skipping delivery to ${sessionId}: socket not connected`,
            );
            return;
        }
        this.toExternalPayload(msg);
        if (msg.type === "error" && typeof msg.actor === "undefined") {
            // ensure an actor is present if not otherwise defined; global
            // platforms have no `this.actor`, so fall back to the platform name
            // (an id-bearing, valid actor).
            msg.actor = { id: this.actor ?? this.name, type: "service" };
        }
        // Validate successful protocol responses against the platform's
        // `responses` schema and drop malformed messages (#1120). Error and
        // failure notifications are exempt: a `type: "error"` envelope, or any
        // message carrying an `error` field (e.g. a failed job echoes the
        // original request plus `error`), is a generic cross-cutting shape, not
        // a protocol response. Platforms without a `responses` schema are a
        // no-op (validateActivityStreamResponse returns "").
        if (msg.type !== "error" && typeof msg.error === "undefined") {
            const responseError = validateActivityStreamResponse(
                msg as ActivityStream,
            );
            if (responseError) {
                this.log.error(
                    `dropping malformed outbound message [${this.name}] to ${sessionId}: ${responseError}`,
                );
                return;
            }
        }
        socket.emit("message", msg as ActivityStream);
    }

    // send message to every connected socket associated with this platform instance.
    private broadcastToSharedPeers(sessionId: string, msg: ActivityStream) {
        for (const sid of this.sessions.values()) {
            if (sid !== sessionId) {
                this.log.debug(`broadcasting message to ${sid}`);
                this.sendToClient(sid, msg);
            }
        }
    }

    /**
     * Strip internal-only transport metadata and stamp the canonical `@context`
     * before returning payloads to clients. Platforms may emit payloads without
     * a `@context`; the instance always knows which platform it represents.
     *
     * Any legacy `context` field is removed so outbound payloads carry only
     * `@context` as the routing signal, regardless of what an internal platform
     * emits.
     */
    private toExternalPayload(payload: ActivityStream): ActivityStream {
        const external = payload as InternalActivityStream & {
            context?: unknown;
        };
        delete external.sessionSecret;
        delete external.context;
        const contextUrl = this.contextUrl ?? INTERNAL_PLATFORM_CONTEXT_URL;
        payload["@context"] = buildCanonicalContext(contextUrl);
        return payload;
    }

    // handle job results coming in on the queue from platform instances
    private async handleJobResult(
        state: string,
        job: JobDataDecrypted,
        result: ActivityStream | undefined,
    ) {
        let payload = result; // some platforms return new AS objects as result
        if (state === "failed") {
            payload = job.msg; // failures always use original AS job object
            payload.error = result
                ? result.toString()
                : "job failed for unknown reason";
        }
        this.log.debug(
            `${job.title} ${state}${payload?.error ? `: ${payload.error}` : ""}`,
        );

        if (!payload || typeof payload === "string") {
            payload = job.msg;
        }

        payload = this.toExternalPayload(payload);

        // send result to client
        const callback = this.takeCompletedJobHandler(job.title);
        if (callback) {
            callback(payload);
        } else {
            this.sendToClient(job.sessionId, payload);
        }

        if (payload) {
            // let all related peers know of result as an independent message
            // (not as part of a job completion, or failure)
            this.broadcastToSharedPeers(job.sessionId, payload);
        }

        // persistent
        if (
            this.config.persist &&
            this.config.requireCredentials?.includes(job.msg.type)
        ) {
            if (state === "failed") {
                // Only terminate if platform is not yet initialized
                // If already initialized, credential failures are non-fatal (wrong session credentials)
                if (!this.initialized) {
                    this.log.warn(
                        `critical job type ${job.msg.type} failed during initialization, flagging for termination`,
                    );
                    await this.queue.pause();
                    this.initialized = false;
                    this.flaggedForTermination = true;
                } else {
                    this.log.debug(
                        `credential job ${job.msg.type} failed on initialized platform, not flagged for termination`,
                    );
                    // Platform stays alive - error sent to client via sendToClient above
                }
            } else {
                this.log.info("persistent platform initialized");
                this.initialized = true;
                this.flaggedForTermination = false;
                await this.queue.resume();
            }
        }
    }

    /**
     * Sends a fatal error message to every connected session, then clears
     * all references to this class. Previously only the session whose
     * listener happened to run first received the error; every other
     * session sharing the instance lost the platform silently.
     */
    private async broadcastFatalError(message: string) {
        const errorObject: ActivityStream = {
            "@context": buildCanonicalContext(
                this.contextUrl ?? INTERNAL_PLATFORM_CONTEXT_URL,
            ),
            type: "error",
            // Global platforms have no `this.actor`; fall back to the platform
            // name so the error always carries a valid (id-bearing) actor.
            actor: { id: this.actor ?? this.name, type: "service" },
            error: message,
        };

        for (const sessionId of this.sessions.values()) {
            try {
                this.sendToClient(sessionId, errorObject);
            } catch (err) {
                this.log.error(
                    `Failed to send error to client: ${errorMessage(err)}`,
                );
            }
        }

        this.sessions.clear();
        await this.shutdown();
    }

    /**
     * Persists renamed credentials for every attached session except the one
     * that already stored them in the platform child before reporting the
     * actor change. `dryRun` performs the same collision checks without
     * writing, so a nick change can be refused before the server applies it.
     */
    private async migratePeerActorCredentials(
        credentials: CredentialsObject,
        previousActorId: string,
        originatingSessionId?: string,
        options?: { dryRun?: boolean },
    ): Promise<void> {
        if (!this.parentSecret1) {
            return;
        }
        const redisConfig = config.get("redis");
        const ttlMs = config.get("credentials:ttlMs") as number | undefined;
        const writers = [];
        for (const sessionId of this.sessions) {
            if (sessionId === originatingSessionId) {
                continue;
            }
            const sessionSecret = this.sessionSecrets.get(sessionId);
            if (!sessionSecret) {
                continue;
            }
            const store = new CredentialsStore(
                this.parentId,
                sessionId,
                derivePlatformCredentialsSecret(
                    this.parentSecret1,
                    sessionSecret,
                ),
                redisConfig,
                { ttlMs },
            );
            writers.push({
                sessionId,
                renameActorCredentials: (
                    fromActorId: string,
                    renamed: CredentialsObject,
                ) =>
                    renameActorCredentialsInStore(
                        store,
                        this.name,
                        fromActorId,
                        renamed,
                        options,
                    ),
            });
        }
        await migrateRenamedActorCredentials(
            this.name,
            previousActorId,
            credentials,
            writers,
        );
    }

    /**
     * Updates the instance with a new identifier, updating the platformInstances mapping as well.
     *
     * The Redis queue stays on the identifier this process was forked with.
     * `this.queue` captured that name in `initQueue()`, and the child worker
     * keeps consuming it. Rebinding either side here would leave jobs on a
     * queue nobody reads.
     *
     * @param identifier
     */
    private updateIdentifier(identifier: string, actorId?: string) {
        if (typeof identifier !== "string" || identifier.length === 0) {
            this.log.error(
                `ignoring actor change with an invalid identifier platform=${this.name}`,
            );
            return;
        }
        const previousId = this.id;
        const previousActor = this.actor;
        platformInstances.delete(this.id);
        this.id = identifier;
        platformInstances.set(this.id, this);
        // Any session-derived scope was recorded against the old identifier
        // and the old actor; move it so a refresh still finds this connection,
        // and so teardown can still clear it.
        reassignAnonymousScopes(previousId, this.id, this.name, actorId);
        if (
            previousActor &&
            typeof actorId === "string" &&
            actorId.length > 0 &&
            actorId !== previousActor
        ) {
            reassignPendingScopes(
                this.sessions,
                this.name,
                previousActor,
                actorId,
            );
            this.actor = actorId;
        }
    }

    /**
     * Attach one message and one close listener to the child process,
     * serving every session registered with this instance. Sessions no
     * longer add their own listener pair, so listener count stays constant
     * regardless of how many sockets share the instance. Previously each
     * session registered two listeners: O(sessions) callback invocations
     * per platform emit, plus MaxListenersExceeded warnings past ten
     * sessions on shared (e.g. global) platforms.
     */
    private sendUpdateActorAck() {
        this.sendToChild(["updateActorAck"]);
    }

    private sendUpdateActorFailed(message: string) {
        this.sendToChild(["updateActorFailed", message]);
    }

    private sendToChild(message: MessageToPlatformChild) {
        if (!this.process?.send) {
            this.log.error(
                `unable to send ${message[0]} to platform child: no IPC channel`,
            );
            return;
        }
        this.process.send(message);
    }

    private attachProcessListeners() {
        if (!this.process?.on) {
            return;
        }
        this.processMessageListener = (message: MessageFromPlatform) => {
            this.handleProcessMessage(message).catch((err) => {
                this.log.error(`message handler failed: ${errorMessage(err)}`);
            });
        };
        this.processCloseListener = (e: unknown) => {
            this.handleProcessClose(e).catch((err) => {
                this.log.error(`close handler failed: ${errorMessage(err)}`);
            });
        };
        this.process.on("message", this.processMessageListener);
        this.process.on("close", this.processCloseListener);
    }

    private async handleProcessClose(e: unknown) {
        this.log.error(`close event triggered ${this.id}: ${e}`);
        // `close` fires after the child has already exited and its IPC channel
        // torn down, so `this.process.connected` is always false by this point —
        // it can't distinguish an unexpected crash from an intentional shutdown.
        // `flaggedForTermination` is set *before* we tear anything down in every
        // intentional path (shutdown(), credential-init failure, heartbeat
        // timeout), so it alone tells us whether this close was expected.
        if (!this.flaggedForTermination) {
            await this.broadcastFatalError(
                `Error: session thread closed unexpectedly: ${e}`,
            );
        } else {
            this.log.debug(
                "process already flagged for termination, skipping error report",
            );
        }
        await this.shutdown();
    }

    private async handleProcessMessage([
        first,
        second,
        third,
        fourth,
        fifth,
        sixth,
    ]: MessageFromPlatform) {
        if (first === "updateActor") {
            // Internal control message: platform process is reporting a new actor id.
            // We need to update the key to the store in order to find it in the future.
            if (typeof third !== "string" || third.length === 0) {
                const message = `actor change rejected: invalid identifier platform=${this.name}`;
                this.log.error(message);
                this.sendUpdateActorFailed(message);
                return;
            }
            // With the dry-run flag the child is asking whether a rename
            // would collide with another session's stored account, before
            // NICK is sent. Nothing is written or re-keyed.
            const dryRun = sixth === true;
            try {
                const credentials = fourth;
                const originatingSessionId =
                    typeof fifth === "string" && fifth.length > 0
                        ? fifth
                        : undefined;
                const previousActor = this.actor;
                if (credentials) {
                    if (
                        typeof previousActor !== "string" ||
                        previousActor.length === 0
                    ) {
                        throw new Error(
                            `cannot migrate peer credentials for ${this.name} without a previous actor`,
                        );
                    }
                    await this.migratePeerActorCredentials(
                        credentials,
                        previousActor,
                        originatingSessionId,
                        { dryRun },
                    );
                }
                if (dryRun) {
                    this.sendUpdateActorAck();
                    return;
                }
                this.updateIdentifier(
                    third,
                    typeof second === "string" ? second : undefined,
                );
                this.sendUpdateActorAck();
            } catch (err) {
                this.sendUpdateActorFailed(errorMessage(err));
                throw err;
            }
        } else if (first === "sessionUnauthorized") {
            if (
                typeof third !== "string" ||
                third.length === 0 ||
                (typeof second !== "undefined" && second !== null)
            ) {
                const sessionContext =
                    typeof third === "string"
                        ? ` sessionId=${JSON.stringify(third)}`
                        : "";
                this.log.error(
                    `ignoring malformed platform IPC control message platform=${this.name} action=sessionUnauthorized${sessionContext}`,
                );
                return;
            }
            // The child could not validate this session's credentials against
            // the running connection. Drop it so the fan-out in this method
            // (and broadcastToSharedPeers) stops delivering the connection's
            // traffic to it. A session that later presents valid credentials
            // re-registers through ProcessManager on its next message.
            this.deregisterSession(third);
        } else if (first === "error") {
            // Error messages travel over IPC as plain objects; normalize to a string.
            let normalizedError: string;
            if (typeof second === "string") {
                normalizedError = second;
            } else if (
                second &&
                typeof second === "object" &&
                "message" in (second as Record<string, unknown>)
            ) {
                normalizedError = String(
                    (second as Record<string, unknown>).message,
                );
            } else {
                try {
                    normalizedError = JSON.stringify(second);
                } catch {
                    normalizedError = String(second);
                }
            }
            await this.broadcastFatalError(normalizedError);
        } else if (first === "heartbeat") {
            // Internal heartbeat signals are handled by the monitor listener only.
            return;
        } else {
            // treat like a message to clients: deliver to every session
            // registered with this platform instance
            for (const sessionId of this.sessions.values()) {
                this.sendToClient(sessionId, second as InternalActivityStream);
            }
        }
    }

    private markHeartbeat() {
        this.heartbeatLastSeen = Date.now();
    }

    private startHeartbeatMonitor() {
        if (
            !Number.isFinite(HEARTBEAT_INTERVAL_MS) ||
            HEARTBEAT_INTERVAL_MS <= 0 ||
            !Number.isFinite(HEARTBEAT_TIMEOUT_MS) ||
            HEARTBEAT_TIMEOUT_MS <= 0
        ) {
            return;
        }
        if (!this.process?.on) {
            return;
        }
        // Track last heartbeat to detect hung platform processes.
        this.heartbeatLastSeen = Date.now();
        this.heartbeatListener = (message: MessageFromPlatform) => {
            if (Array.isArray(message) && message[0] === "heartbeat") {
                this.markHeartbeat();
            }
        };
        this.process.on("message", this.heartbeatListener);
        this.heartbeatMonitor = setInterval(() => {
            // Avoid double-handling once shutdown starts or a timeout was already handled.
            if (this.flaggedForTermination || this.heartbeatFailureHandled) {
                return;
            }
            if (!this.process?.connected) {
                return;
            }
            const elapsed = Date.now() - this.heartbeatLastSeen;
            if (elapsed > HEARTBEAT_TIMEOUT_MS) {
                this.heartbeatFailureHandled = true;
                this.log.error(
                    `heartbeat timeout for ${this.id} after ${elapsed}ms`,
                );
                // The child is unresponsive; mark for termination and trigger shutdown.
                this.flaggedForTermination = true;
                void this.shutdown();
            }
        }, HEARTBEAT_INTERVAL_MS);
    }
}
