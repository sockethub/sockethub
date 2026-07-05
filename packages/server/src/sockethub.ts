import { createHash } from "node:crypto";
import type {
    CredentialsStoreInterface,
    RedisConfig,
} from "@sockethub/data-layer";
import {
    CredentialsStore,
    purgeCredentialsStores,
} from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import {
    AS2_BASE_CONTEXT_URL,
    buildCanonicalContext,
    ERROR_PLATFORM_CONTEXT_URL,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "@sockethub/schemas";
import { crypto } from "@sockethub/util/crypto";
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

function getCredentialsTtlMs(): number | undefined {
    const ttlMs = Number(config.get("credentials:ttlMs") ?? 0);
    return Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : undefined;
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
    // Concurrent socket connections per client IP; used to enforce
    // rateLimiter.maxConnectionsPerIp.
    private readonly socketsPerIp = new Map<string, number>();
    private serverVersion?: string;
    private platformRegistryPayloadCache?: {
        payload: ReturnType<Sockethub["buildPlatformRegistryPayload"]> & {
            fingerprint: string;
        };
        fingerprint: string;
    };

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

    /**
     * Return the platform registry payload plus a content fingerprint, computed
     * once and cached. The registry is static after platform load, so clients
     * that already hold a matching fingerprint can be told "unchanged" instead
     * of being re-sent the full (tens-of-KB) schema set on every reconnect or
     * re-request (see #1117).
     */
    private getPlatformRegistryPayload() {
        if (!this.platformRegistryPayloadCache) {
            const base = this.buildPlatformRegistryPayload();
            const fingerprint = createHash("sha256")
                .update(JSON.stringify(base))
                .digest("hex")
                .slice(0, 16);
            this.platformRegistryPayloadCache = {
                payload: { fingerprint, ...base },
                fingerprint,
            };
        }
        return this.platformRegistryPayloadCache;
    }

    constructor() {
        this.status = false;
        // Identifier, not a secret: ends up in Redis key names and logger
        // namespaces, so it must stay free of glob/shell metacharacters.
        this.parentId = crypto.randId(16);
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
        // Reclaim this instance's credential keys: parentId is randomized per
        // boot, so any key left behind would be stranded under a prefix no
        // future boot references (until its TTL lapses).
        try {
            const removed = await purgeCredentialsStores(
                this.parentId,
                config.get("redis") as RedisConfig,
            );
            log.debug(`purged ${removed} credential store keys on shutdown`);
        } catch (err) {
            log.warn(`failed to purge credential store keys: ${err}`);
        }
    }

    /**
     * Reserve a connection slot for the client IP. Returns false (after
     * notifying and disconnecting the socket) when the configured
     * per-IP connection cap has been reached.
     */
    private claimIpSlot(
        socket: Socket,
        clientIp: string,
        sessionLog: ReturnType<typeof createLogger>,
    ): boolean {
        const max = Number(config.get("rateLimiter:maxConnectionsPerIp") ?? 0);
        if (!Number.isFinite(max) || max <= 0 || !clientIp) {
            return true;
        }
        const current = this.socketsPerIp.get(clientIp) ?? 0;
        if (current >= max) {
            sessionLog.warn(
                `connection limit reached for ${clientIp} (${current}/${max}), rejecting socket`,
            );
            socket.emit("error", {
                type: "Error",
                "@context": buildCanonicalContext(ERROR_PLATFORM_CONTEXT_URL),
                actor: {
                    type: "Application",
                    name: "sockethub-server",
                },
                summary: "too many concurrent connections from this address",
            });
            socket.disconnect(true);
            return false;
        }
        this.socketsPerIp.set(clientIp, current + 1);
        return true;
    }

    private releaseIpSlot(clientIp: string): void {
        if (!clientIp) {
            return;
        }
        const current = this.socketsPerIp.get(clientIp) ?? 0;
        if (current <= 1) {
            this.socketsPerIp.delete(clientIp);
        } else {
            this.socketsPerIp.set(clientIp, current - 1);
        }
    }

    /**
     * Configure all socket listeners and middleware for a single client session.
     */
    private handleIncomingConnection(socket: Socket) {
        // session-specific debug messages
        const sessionLog = createLogger(`server:core:${socket.id}`);
        const sessionSecret = crypto.randToken(16);
        const clientIp = getClientIp(socket);

        // The per-event rate limiter is keyed by socket id, so a client can
        // bypass it by opening more sockets; cap concurrent connections per
        // IP when configured (0 = disabled).
        if (!this.claimIpSlot(socket, clientIp, sessionLog)) {
            return;
        }
        const credentialsStore: CredentialsStoreInterface =
            new CredentialsStore(
                this.parentId,
                socket.id,
                crypto.deriveSecret(this.parentSecret1, sessionSecret),
                config.get("redis"),
                { ttlMs: getCredentialsTtlMs() },
            );

        sessionLog.debug("socket.io connection");
        const { payload: platformRegistryPayload, fingerprint } =
            this.getPlatformRegistryPayload();

        // Rate limiting middleware - runs on every incoming event
        socket.use((event, next) => {
            this.rateLimiter(socket, event[0], next);
        });

        // Serve the platform registry on demand. The client (SockethubClient)
        // requests it on every connect/reconnect and echoes the fingerprint it
        // last received; when that matches we reply "unchanged" so a reconnect
        // or re-request doesn't re-transmit the full schema set (#1117).
        socket.on("schemas", (...args: unknown[]) => {
            const ack = args.find(
                (a): a is (payload: unknown) => void => typeof a === "function",
            );
            const clientFingerprint = args.find(
                (a): a is string => typeof a === "string",
            );
            const response =
                clientFingerprint === fingerprint
                    ? { fingerprint, unchanged: true }
                    : platformRegistryPayload;
            if (ack) {
                ack(response);
            } else {
                socket.emit("schemas", response);
            }
        });

        socket.on("disconnect", () => {
            sessionLog.debug("disconnect received from client");
            // The session's credential key is dead weight once the socket
            // closes: a reconnect gets a new socket.id (and the client
            // re-sends credentials), so nothing ever reads it again.
            void credentialsStore.teardown?.();
            cleanupClient(socket.id);
            this.releaseIpSlot(clientIp);
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
        socket.on("message", handlers.message);
    }
}

export default Sockethub;
