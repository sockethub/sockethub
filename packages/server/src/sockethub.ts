import { crypto } from "@sockethub/crypto";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import { CredentialsStore } from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import type { Socket } from "socket.io";
import getInitObject from "./bootstrap/init.js";
import type { PlatformMap } from "./bootstrap/load-platforms.js";
import config from "./config";
import { registerHttpActionsRoutes } from "./http/actions.js";
import janitor from "./janitor.js";
import listener from "./listener.js";
import { createMessageHandlers } from "./message-handlers.js";
import ProcessManager from "./process-manager.js";
import {
    cleanupClient,
    createRateLimiter,
    stopCleanup,
} from "./rate-limiter.js";

const log = createLogger("server:core");

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
        registerHttpActionsRoutes(listener.getApp(), {
            processManager: this.processManager,
            parentId: this.parentId,
            parentSecret1: this.parentSecret1,
        });
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

        const handlers = createMessageHandlers({
            processManager: this.processManager,
            sessionId: socket.id,
            sessionSecret,
            credentialsStore,
            onPlatformInstance: (platformInstance) => {
                platformInstance.registerSession(socket.id);
            },
        });

        socket.on("credentials", handlers.credentials);

        // when new activity objects are created on the client side, an event is
        // fired, and we receive a copy on the server side.
        socket.on("activity-object", handlers.activityObject);

        socket.on("message", handlers.message);
    }
}

export default Sockethub;
