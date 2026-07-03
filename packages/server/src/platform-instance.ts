import { type ChildProcess, fork } from "node:child_process";
import { join } from "node:path";

import { type JobDataDecrypted, JobQueue } from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import type {
    ActivityStream,
    CompletedJobHandler,
    InternalActivityStream,
    Logger,
    PlatformConfig,
} from "@sockethub/schemas";
import {
    buildCanonicalContext,
    INTERNAL_PLATFORM_CONTEXT_URL,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
import { errorMessage } from "@sockethub/util/error";
import config from "./config.js";
import { getSocket } from "./listener.js";
import { __dirname } from "./util.js";

// collection of platform instances, stored by `id`
export const platformInstances = new Map<string, PlatformInstance>();

export interface PlatformInstanceParams {
    identifier: string;
    platform: string;
    parentId?: string;
    actor?: string;
}

type EnvFormat = {
    LOG_LEVEL?: string;
    REDIS_URL: string;
    SOCKETHUB_PLATFORM_CHILD?: string;
    SOCKETHUB_PLATFORM_CONFIG?: string;
    SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS?: string;
    SOCKETHUB_PLATFORM_HEARTBEAT_TIMEOUT_MS?: string;
};

type MessageFromPlatform =
    | ["updateActor", ActivityStream | undefined, string]
    | ["error", string]
    | ["heartbeat", ActivityStream]
    | [string, ActivityStream, string?];

export interface MessageFromParent extends Array<string | unknown> {
    0: string;
    1: unknown;
}

const HEARTBEAT_INTERVAL_MS = Number(
    config.get("platformHeartbeat:intervalMs") ?? 5000,
);
const HEARTBEAT_TIMEOUT_MS = Number(
    config.get("platformHeartbeat:timeoutMs") ?? 15000,
);

export default class PlatformInstance {
    id: string;
    flaggedForTermination = false;
    queue: JobQueue;
    JobQueue: typeof JobQueue;
    getSocket: typeof getSocket;
    readonly global: boolean = false;
    readonly completedJobHandlers: Map<string, CompletedJobHandler> = new Map();
    config: PlatformConfig;
    contextUrl?: string;
    private initialized = false;
    readonly name: string;
    process: ChildProcess;
    readonly log: Logger;
    readonly parentId: string;
    readonly sessions: Set<string> = new Set();
    readonly sessionIps: Map<string, string> = new Map();
    private processMessageListener?: (message: MessageFromPlatform) => void;
    private processCloseListener?: (e: unknown) => void;
    private heartbeatLastSeen = Date.now();
    private heartbeatMonitor?: NodeJS.Timeout;
    private heartbeatListener?: (message: MessageFromPlatform) => void;
    private heartbeatFailureHandled = false;
    private readonly actor?: string;

    constructor(params: PlatformInstanceParams) {
        this.id = params.identifier;
        this.name = params.platform;
        this.parentId = params.parentId;
        if (params.actor) {
            this.actor = params.actor;
        } else {
            this.global = true;
        }

        this.log = createLogger(`server:platform-instance:${this.id}`);
        const env: EnvFormat = {
            REDIS_URL: config.get("redis:url") as string,
            SOCKETHUB_PLATFORM_CHILD: "1",
        };
        if (process.env.LOG_LEVEL) {
            env.LOG_LEVEL = process.env.LOG_LEVEL;
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
     * Destroys all references to this platform instance, internal listeners and controlled processes
     */
    public async shutdown() {
        this.log.debug("platform process shutdown");
        this.flaggedForTermination = true;

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
                this.process.removeListener(
                    "close",
                    this.processCloseListener,
                );
                this.processCloseListener = undefined;
            }
            this.process.removeAllListeners("close");
            this.process.unref();
            this.process.kill();
        } catch (_e) {
            // needs to happen
        }

        try {
            await this.queue.shutdown();
            this.queue = undefined;
        } catch (_e) {
            // this needs to happen
        }

        try {
            platformInstances.delete(this.id);
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
            this.id,
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
        const callback = this.completedJobHandlers.get(job.title);
        if (callback) {
            callback(payload);
            this.completedJobHandlers.delete(job.title);
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
     * Updates the instance with a new identifier, updating the platformInstances mapping as well.
     * @param identifier
     */
    private updateIdentifier(identifier: string) {
        platformInstances.delete(this.id);
        this.id = identifier;
        platformInstances.set(this.id, this);
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
    private attachProcessListeners() {
        if (!this.process?.on) {
            return;
        }
        this.processMessageListener = (message: MessageFromPlatform) => {
            void this.handleProcessMessage(message);
        };
        this.processCloseListener = (e: unknown) => {
            void this.handleProcessClose(e);
        };
        this.process.on("message", this.processMessageListener);
        this.process.on("close", this.processCloseListener);
    }

    private async handleProcessClose(e: unknown) {
        this.log.error(`close event triggered ${this.id}: ${e}`);
        // Check if process is still connected before attempting error reporting
        if (this.process?.connected && !this.flaggedForTermination) {
            await this.broadcastFatalError(
                `Error: session thread closed unexpectedly: ${e}`,
            );
        } else {
            this.log.debug(
                "Process already disconnected or flagged for termination, skipping error report",
            );
            await this.shutdown();
        }
    }

    private async handleProcessMessage([
        first,
        second,
        third,
    ]: MessageFromPlatform) {
        if (first === "updateActor") {
            // Internal control message: platform process is reporting a new actor id.
            // We need to update the key to the store in order to find it in the future.
            this.updateIdentifier(third);
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
