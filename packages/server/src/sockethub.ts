import { crypto } from "@sockethub/crypto";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import { CredentialsStore } from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import {
    AS2_BASE_CONTEXT_URL,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "@sockethub/schemas";
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

function normalizeIp(ip: string | undefined): string {
    if (!ip) {
        return "";
    }
    const trimmed = ip.split(",")[0].trim();
    if (trimmed.startsWith("::ffff:")) {
        return trimmed.slice(7);
    }
    return trimmed;
}

function getProxyHeaderName(): string {
    return (
        (
            config.get("credentialCheck:proxyHeader") as string | undefined
        )?.toLowerCase() || "x-forwarded-for"
    );
}

function getClientIp(socket: Socket): string {
    const ipSource =
        config.get("credentialCheck:reconnectIpSource") === "proxy"
            ? "proxy"
            : "socket";

    if (ipSource === "proxy") {
        const proxyHeader = getProxyHeaderName();
        const headerValue = socket.handshake.headers[proxyHeader];
        if (typeof headerValue === "string") {
            const normalized = normalizeIp(headerValue);
            if (normalized) {
                return normalized;
            }
        } else if (Array.isArray(headerValue) && headerValue.length > 0) {
            const normalized = normalizeIp(headerValue[0]);
            if (normalized) {
                return normalized;
            }
        }
    }

    return normalizeIp(socket.handshake.address);
}

/**
 * Main Socket.IO entrypoint for Sockethub runtime.
 * Owns platform registry metadata, per-session middleware wiring, and routing.
 */
class Sockethub {
    private readonly parentId: string;
    private readonly parentSecret1: string;
    private readonly parentSecret2: string;
    counter = 0;
    platformRegistry: PlatformMap = new Map();
    status: boolean;
    processManager!: ProcessManager;
    private rateLimiter!: ReturnType<typeof createRateLimiter>;
    private serverVersion?: string;

    /**
     * Build the platform registry payload sent to clients.
     * This is the canonical source for base contexts + platform context/schema metadata.
     */
    private buildPlatformRegistryPayload() {
        return {
            version: this.serverVersion,
            contexts: {
                as: AS2_BASE_CONTEXT_URL,
                sockethub: SOCKETHUB_BASE_CONTEXT_URL,
            },
            platforms: Array.from(this.platformRegistry.values()).map(
                (platform) => ({
                    id: platform.id,
                    version: platform.version,
                    contextUrl: platform.contextUrl,
                    contextVersion: platform.contextVersion,
                    schemaVersion: platform.schemaVersion,
                    types: platform.types,
                    schemas: {
                        credentials: platform.schemas.credentials || {},
                        messages: platform.schemas.messages || {},
                    },
                }),
            ),
        };
    }

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

        this.serverVersion = init.version;
        this.processManager = new ProcessManager(
            this.parentId,
            this.parentSecret1,
            this.parentSecret2,
            init,
        );

        this.platformRegistry = init.platforms;

        // Create rate limiter once at server level
        this.rateLimiter = createRateLimiter(config.get("rateLimiter"));

        if (config.get("credentialCheck:reconnectIpSource") === "proxy") {
            const proxyHeader = getProxyHeaderName();
            log.warn(
                `credentialCheck.reconnectIpSource=proxy enabled; only use this behind a trusted reverse proxy that overwrites '${proxyHeader}'`,
            );
        }

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

    /**
     * Configure all socket listeners and middleware for a single client session.
     */
    private handleIncomingConnection(socket: Socket) {
        // session-specific debug messages
        const sessionLog = createLogger(`server:core:${socket.id}`);
        const sessionSecret = crypto.randToken(16);
        const clientIp = getClientIp(socket);
        const credentialsStore: CredentialsStoreInterface =
            new CredentialsStore(
                this.parentId,
                socket.id,
                crypto.deriveSecret(this.parentSecret1, sessionSecret),
                config.get("redis"),
            );

        sessionLog.debug("socket.io connection");
        const platformRegistryPayload = this.buildPlatformRegistryPayload();

        // Rate limiting middleware - runs on every incoming event
        socket.use((event, next) => {
            this.rateLimiter(socket, event[0], next);
        });

        // Send schema metadata to clients immediately and on-demand.
        socket.emit("schemas", platformRegistryPayload);
        socket.on("schemas", (...args: unknown[]) => {
            const ack = args.find(
                (a): a is (payload: unknown) => void => typeof a === "function",
            );
            if (ack) {
                ack(platformRegistryPayload);
            } else {
                socket.emit("schemas", platformRegistryPayload);
            }
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
            clientIp,
            isSessionActive: (sessionId) =>
                listener.io?.sockets?.sockets?.has(sessionId) ?? false,
            // Keep session registration behavior inside ProcessManager.get().
            platformSessionId: socket.id,
        });

        socket.on("credentials", handlers.credentials);

        // when new activity objects are created on the client side, an event is
        // fired, and we receive a copy on the server side.
        socket.on("activity-object", handlers.activityObject);
        socket.on("message", handlers.message);
    }
}

export default Sockethub;
