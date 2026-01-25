import { type ChildProcess, fork } from "node:child_process";
import { join } from "node:path";

import { type JobDataDecrypted, JobQueue } from "@sockethub/data-layer";
import type {
    ActivityStream,
    CompletedJobHandler,
    InternalActivityStream,
    Logger,
    PlatformConfig,
} from "@sockethub/schemas";
import type { Socket } from "socket.io";

import config from "./config.js";
import { getSocket } from "./listener.js";
import { createLogger } from "./logger.js";
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
    DEBUG?: string;
    LOG_LEVEL?: string;
    REDIS_URL: string;
};

interface MessageFromPlatform extends Array<string | ActivityStream> {
    0: string;
    1: ActivityStream;
    2: string;
}

export interface MessageFromParent extends Array<string | unknown> {
    0: string;
    1: unknown;
}

export default class PlatformInstance {
    id: string;
    flaggedForTermination = false;
    queue: JobQueue;
    JobQueue: typeof JobQueue;
    getSocket: typeof getSocket;
    readonly global: boolean = false;
    readonly completedJobHandlers: Map<string, CompletedJobHandler> = new Map();
    config: PlatformConfig;
    readonly name: string;
    process: ChildProcess;
    readonly debug: Logger;
    readonly parentId: string;
    readonly sessions: Set<string> = new Set();
    readonly sessionCallbacks: object = {
        close: (() => new Map())(),
        message: (() => new Map())(),
    };
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

        this.debug = createLogger({
            namespace: `sockethub:server:platform-instance:${this.id}`,
        });
        const env: EnvFormat = {
            REDIS_URL: config.get("redis:url") as string,
        };
        if (process.env.DEBUG) {
            env.DEBUG = process.env.DEBUG;
        }
        if (process.env.LOG_LEVEL) {
            env.LOG_LEVEL = process.env.LOG_LEVEL;
        }

        this.createQueue();
        this.initProcess(this.parentId, this.name, this.id, env);
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
            { env: env },
        );
    }

    createGetSocket() {
        this.getSocket = getSocket;
    }

    /**
     * Destroys all references to this platform instance, internal listeners and controlled processes
     */
    public async shutdown() {
        this.debug.debug("platform process shutdown");
        this.flaggedForTermination = true;

        try {
            this.process.removeAllListeners("close");
            this.process.unref();
            this.process.kill();
        } catch (e) {
            // needs to happen
        }

        try {
            await this.queue.shutdown();
            this.queue = undefined;
        } catch (e) {
            // this needs to happen
        }

        try {
            platformInstances.delete(this.id);
        } catch (e) {
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
    public registerSession(sessionId: string) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.add(sessionId);
            for (const type of Object.keys(this.sessionCallbacks)) {
                const cb = this.callbackFunction(type, sessionId);
                this.process.on(type, cb);
                this.sessionCallbacks[type].set(sessionId, cb);
            }
        }
    }

    /**
     * Sends a message to client (user), can be registered with an event emitted from the platform
     * process.
     * @param sessionId ID of the socket connection to send the message to
     * @param msg ActivityStream object to send to client
     */
    public async sendToClient(sessionId: string, msg: InternalActivityStream) {
        return this.getSocket(sessionId).then(
            (socket: Socket) => {
                try {
                    // this property should never be exposed externally
                    // biome-ignore lint/performance/noDelete: <explanation>
                    delete msg.sessionSecret;
                } finally {
                    msg.context = this.name;
                    if (
                        msg.type === "error" &&
                        typeof msg.actor === "undefined" &&
                        this.actor
                    ) {
                        // ensure an actor is present if not otherwise defined
                        msg.actor = { id: this.actor, type: "unknown" };
                    }
                    socket.emit("message", msg as ActivityStream);
                }
            },
            (err) => this.debug.error(`sendToClient ${err}`),
        );
    }

    // send message to every connected socket associated with this platform instance.
    private broadcastToSharedPeers(sessionId: string, msg: ActivityStream) {
        for (const sid of this.sessions.values()) {
            if (sid !== sessionId) {
                this.debug.debug(`broadcasting message to ${sid}`);
                this.sendToClient(sid, msg);
            }
        }
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
        this.debug.debug(
            `${job.title} ${state}${payload?.error ? `: ${payload.error}` : ""}`,
        );

        if (!payload || typeof payload === "string") {
            payload = job.msg;
        }

        // send result to client
        const callback = this.completedJobHandlers.get(job.title);
        if (callback) {
            callback(payload);
            this.completedJobHandlers.delete(job.title);
        } else {
            await this.sendToClient(job.sessionId, payload);
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
                if (!this.config.initialized) {
                    this.debug.warn(
                        `critical job type ${job.msg.type} failed during initialization, flagging for termination`,
                    );
                    await this.queue.pause();
                    this.config.initialized = false;
                    this.flaggedForTermination = true;
                } else {
                    this.debug.debug(
                        `credential job ${job.msg.type} failed on initialized platform, not flagged for termination`,
                    );
                    // Platform stays alive - error sent to client via sendToClient above
                }
            } else {
                this.debug.info("persistent platform initialized");
                await this.queue.resume();
                this.config.initialized = true;
                this.flaggedForTermination = false;
            }
        }
    }

    /**
     * Sends error message to client and clears all references to this class.
     * @param sessionId
     * @param errorMessage
     */
    private async reportError(sessionId: string, errorMessage: string) {
        const errorObject: ActivityStream = {
            context: this.name,
            type: "error",
            actor: { id: this.actor, type: "unknown" },
            error: errorMessage,
        };

        // Only attempt to send to client if we have a valid session
        try {
            if (sessionId && this.sessions.has(sessionId)) {
                await this.sendToClient(sessionId, errorObject);
            }
        } catch (err) {
            this.debug.error(`Failed to send error to client: ${err.message}`);
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
     * Generates a function tied to a given client session (socket connection), the generated
     * function will be called for each session ID registered, for every platform emit.
     * @param listener
     * @param sessionId
     */
    private callbackFunction(listener: string, sessionId: string) {
        const funcs = {
            close: async (e: object) => {
                this.debug.error(`close event triggered ${this.id}: ${e}`);
                // Check if process is still connected before attempting error reporting
                if (this.process?.connected && !this.flaggedForTermination) {
                    await this.reportError(
                        sessionId,
                        `Error: session thread closed unexpectedly: ${e}`,
                    );
                } else {
                    this.debug.debug(
                        "Process already disconnected or flagged for termination, skipping error report",
                    );
                    await this.shutdown();
                }
            },
            message: async ([first, second, third]: MessageFromPlatform) => {
                if (first === "updateActor") {
                    // We need to update the key to the store in order to find it in the future.
                    this.updateIdentifier(third);
                } else if (first === "error" && typeof second === "string") {
                    await this.reportError(sessionId, second);
                } else {
                    // treat like a message to clients
                    await this.sendToClient(sessionId, second);
                }
            },
        };
        return funcs[listener];
    }
}
