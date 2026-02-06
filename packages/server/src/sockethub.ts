import type { Socket } from "socket.io";

import { crypto } from "@sockethub/crypto";
import { CredentialsStore } from "@sockethub/data-layer";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type {
    ActivityObject,
    ActivityStream,
    InternalActivityStream,
} from "@sockethub/schemas";
import {
    cleanupClient,
    createRateLimiter,
    stopCleanup,
} from "./rate-limiter.js";

import { createLogger } from "@sockethub/logger";
import getInitObject from "./bootstrap/init.js";
import type { PlatformMap } from "./bootstrap/load-platforms.js";
import config from "./config";
import janitor from "./janitor.js";
import listener from "./listener.js";
import middleware from "./middleware.js";
import createActivityObject from "./middleware/create-activity-object.js";
import expandActivityStream from "./middleware/expand-activity-stream.js";
import restrictSharedSessions from "./middleware/restrict-shared-sessions.js";
import storeCredentials from "./middleware/store-credentials.js";
import validate from "./middleware/validate.js";
import ProcessManager from "./process-manager.js";

const log = createLogger("server:core");

function attachError<T extends ActivityStream | ActivityObject>(
    err: unknown,
    msg?: T,
) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (!msg) {
        return new Error(errorMessage);
    }

    const cleaned = { ...msg, error: errorMessage } as T & {
        sessionSecret?: string;
    };
    if ("sessionSecret" in cleaned) {
        // biome-ignore lint/performance/noDelete: <explanation>
        delete cleaned.sessionSecret;
    }
    return cleaned;
}

class Sockethub {
    private readonly parentId: string;
    private readonly parentSecret1: string;
    private readonly parentSecret2: string;
    counter = 0;
    platformRegistry: PlatformMap = new Map();
    status: boolean;
    processManager!: ProcessManager;
    private rateLimiter!: ReturnType<typeof createRateLimiter>;

    constructor() {
        this.status = false;
        this.parentId = crypto.randToken(16);
        this.parentSecret1 = crypto.randToken(16);
        this.parentSecret2 = crypto.randToken(16);
        log.debug(`session id: ${this.parentId}`);
    }

    /**
     * initialization of Sockethub starts here
     */
    async boot() {
        if (this.status) {
            log.warn("Sockethub.boot() called more than once");
            return;
        }
        this.status = true;

        const init = await getInitObject().catch((err) => {
            log.error(err);
            process.exit(1);
        });
        if (!init) {
            return;
        }

        this.processManager = new ProcessManager(
            this.parentId,
            this.parentSecret1,
            this.parentSecret2,
            init,
        );

        this.platformRegistry = init.platforms;

        // Create rate limiter once at server level
        this.rateLimiter = createRateLimiter(config.get("rateLimiter"));

        log.debug("active platforms: ", [...init.platforms.keys()]);
        listener.start(); // start external services
        janitor.start(); // start cleanup cycle
        log.debug("registering handlers");
        listener.io.on("connection", this.handleIncomingConnection.bind(this));
    }

    async shutdown() {
        await janitor.stop();
        stopCleanup();
    }

    private handleIncomingConnection(socket: Socket) {
        // session-specific debug messages
        const sessionLog = createLogger(`server:core:${socket.id}`);
        const sessionSecret = crypto.randToken(16);
        const credentialsStore: CredentialsStoreInterface =
            new CredentialsStore(
                this.parentId,
                socket.id,
                crypto.deriveSecret(this.parentSecret1, sessionSecret),
                config.get("redis"),
            );

        sessionLog.debug("socket.io connection");

        // Rate limiting middleware - runs on every incoming event
        socket.use((event, next) => {
            this.rateLimiter(socket, event[0], next);
        });

        socket.on("disconnect", () => {
            sessionLog.debug("disconnect received from client");
            cleanupClient(socket.id);
        });

        socket.on(
            "credentials",
            middleware<ActivityStream>("credentials")
                .use(expandActivityStream)
                .use(validate("credentials", socket.id))
                .use(storeCredentials(credentialsStore))
                .use(
                    (
                        err: Error,
                        data: ActivityStream,
                        next: (data?: ActivityStream | Error) => void,
                    ) => {
                        // error handler
                        next(attachError(err, data));
                    },
                )
                .use(
                    (
                        data: ActivityStream,
                        next: (data?: ActivityStream | Error) => void,
                    ) => {
                        next(data);
                    },
                )
                .done(),
        );

        // when new activity objects are created on the client side, an event is
        // fired, and we receive a copy on the server side.
        socket.on(
            "activity-object",
            middleware<ActivityObject>("activity-object")
                .use(validate("activity-object", socket.id))
                .use(createActivityObject)
                .use(
                    (
                        err: Error,
                        data: ActivityObject,
                        next: (data?: ActivityObject | Error) => void,
                    ) => {
                        next(attachError(err, data));
                    },
                )
                .use(
                    (
                        data: ActivityObject,
                        next: (data?: ActivityObject | Error) => void,
                    ) => {
                        next(data);
                    },
                )
                .done(),
        );

        socket.on(
            "message",
            middleware<InternalActivityStream>("message")
                .use(expandActivityStream)
                .use(validate("message", socket.id))
                .use(
                    (
                        msg: InternalActivityStream,
                        next: (data?: InternalActivityStream | Error) => void,
                    ) => {
                        // The platform thread must find the credentials on their own using the given
                        // sessionSecret, which indicates that this specific session (socket
                        // connection) has provided credentials.
                        msg.sessionSecret = sessionSecret;
                        next(msg);
                    },
                )
                .use(restrictSharedSessions(credentialsStore, socket.id))
                .use(
                    (
                        err: Error,
                        data: InternalActivityStream,
                        next: (data?: InternalActivityStream | Error) => void,
                    ) => {
                        next(attachError(err, data));
                    },
                )
                .use(
                    async (
                        msg: ActivityStream,
                        next: (data?: ActivityStream | Error) => void,
                    ) => {
                        const platformInstance = this.processManager.get(
                            msg.context,
                            msg.actor.id,
                            socket.id,
                        );
                        // job validated and queued, stores socket.io callback for when job is completed
                        try {
                            const job = await platformInstance.queue.add(
                                socket.id,
                                msg,
                            );
                            if (job) {
                                platformInstance.completedJobHandlers.set(
                                    job.title,
                                    next,
                                );
                            } else {
                                // failed to add job to queue, reject handler immediately
                                msg.error = "failed to add job to queue";
                                next(msg);
                            }
                        } catch (err) {
                            // Queue is closed (platform terminating) - send error to client
                            const errorMessage =
                                err instanceof Error
                                    ? err.message
                                    : String(err);
                            msg.error = errorMessage || "platform unavailable";
                            next(msg);
                        }
                    },
                )
                .done(),
        );
    }
}

export default Sockethub;
