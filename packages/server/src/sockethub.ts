import type { Socket } from "socket.io";

import { crypto } from "@sockethub/crypto";
import { CredentialsStore } from "@sockethub/data-layer";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type {
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
import config from "./config";
import janitor from "./janitor.js";
import listener from "./listener.js";
import middleware from "./middleware.js";
import createActivityObject from "./middleware/create-activity-object.js";
import expandActivityStream from "./middleware/expand-activity-stream.js";
import storeCredentials from "./middleware/store-credentials.js";
import validate from "./middleware/validate.js";
import ProcessManager from "./process-manager.js";

const log = createLogger("server:core");

type ErrMsg = {
    context: string;
    error: string;
    content: object;
};

function attachError(err: unknown, msg: InternalActivityStream | undefined) {
    const finalError: ErrMsg = {
        context: "error",
        error: err.toString(),
        content: {},
    };

    // biome-ignore lint/performance/noDelete: <explanation>
    delete msg.sessionSecret;

    if (msg) {
        finalError.content = msg;
    }
    return finalError;
}

class Sockethub {
    private readonly parentId: string;
    private readonly parentSecret1: string;
    private readonly parentSecret2: string;
    counter: number;
    platforms: Map<string, object>;
    status: boolean;
    processManager: ProcessManager;
    private rateLimiter: ReturnType<typeof createRateLimiter>;

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
            return log.warn("Sockethub.boot() called more than once");
        }
        this.status = true;

        const init = await getInitObject().catch((err) => {
            log.error(err);
            process.exit(1);
        });

        this.processManager = new ProcessManager(
            this.parentId,
            this.parentSecret1,
            this.parentSecret2,
            init,
        );

        this.platforms = init.platforms;

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
                this.parentSecret1 + sessionSecret,
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
            middleware("credentials")
                .use(expandActivityStream)
                .use(validate("credentials", socket.id))
                .use(storeCredentials(credentialsStore))
                .use((err, data, next) => {
                    // error handler
                    next(attachError(err, data));
                })
                .use((data, next) => {
                    next();
                })
                .done(),
        );

        // when new activity objects are created on the client side, an event is
        // fired, and we receive a copy on the server side.
        socket.on(
            "activity-object",
            middleware("activity-object")
                .use(validate("activity-object", socket.id))
                .use(createActivityObject)
                .use((err, data, next) => {
                    next(attachError(err, data));
                })
                .use((data, next) => {
                    next();
                })
                .done(),
        );

        socket.on(
            "message",
            middleware("message")
                .use(expandActivityStream)
                .use(validate("message", socket.id))
                .use((msg, next) => {
                    // The platform thread must find the credentials on their own using the given
                    // sessionSecret, which indicates that this specific session (socket
                    // connection) has provided credentials.
                    msg.sessionSecret = sessionSecret;
                    next(msg);
                })
                .use((err, data, next) => {
                    next(attachError(err, data));
                })
                .use(async (msg: ActivityStream, next) => {
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
                        msg.error = err.message || "platform unavailable";
                        next(msg);
                    }
                })
                .done(),
        );
    }
}

export default Sockethub;
