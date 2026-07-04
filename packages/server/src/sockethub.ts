import { createHash } from "node:crypto";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import { CredentialsStore } from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import type {
    ActivityStream,
    InternalActivityStream,
} from "@sockethub/schemas";
import {
    AS2_BASE_CONTEXT_URL,
    resolvePlatformId,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "@sockethub/schemas";
import { crypto } from "@sockethub/util/crypto";
import { errorMessage } from "@sockethub/util/error";
import type { Socket } from "socket.io";
import getInitObject from "./bootstrap/init.js";
import type { PlatformMap } from "./bootstrap/load-platforms.js";
import config from "./config";
import janitor from "./janitor.js";
import listener from "./listener.js";
import credentialCheck from "./middleware/credential-check.js";
import normalizeActivityStreamMiddleware from "./middleware/normalize-activity-stream.js";
import storeCredentials from "./middleware/store-credentials.js";
import validate from "./middleware/validate.js";
import middleware from "./middleware.js";
import ProcessManager from "./process-manager.js";
import {
    cleanupClient,
    createRateLimiter,
    stopCleanup,
} from "./rate-limiter.js";

const log = createLogger("server:core");

/**
 * Normalize middleware errors into payload-safe error responses.
 * Removes internal-only properties that must never be sent to clients.
 */
function attachError<T extends ActivityStream | ActivityObject>(
    err: unknown,
    msg?: T,
) {
    const message = errorMessage(err);
    if (!msg) {
        return new Error(message);
    }

    const cleaned = { ...msg, error: message } as T & {
        sessionSecret?: string;
    };
    if ("sessionSecret" in cleaned) {
        delete cleaned.sessionSecret;
    }
    return cleaned;
}

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
            cleanupClient(socket.id);
        });

        socket.on(
            "credentials",
            middleware<ActivityStream>("credentials")
                .use(normalizeActivityStreamMiddleware)
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

        socket.on(
            "message",
            middleware<InternalActivityStream>("message")
                .use(normalizeActivityStreamMiddleware)
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
                .use(
                    credentialCheck(
                        credentialsStore,
                        socket.id,
                        clientIp,
                        (sessionId) =>
                            listener.io?.sockets?.sockets?.has(sessionId) ??
                            false,
                    ),
                )
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
                        const platformId = resolvePlatformId(msg);
                        if (!platformId) {
                            msg.error =
                                "unable to resolve platform from @context";
                            next(msg);
                            return;
                        }
                        let platformInstance: ReturnType<ProcessManager["get"]>;
                        try {
                            platformInstance = this.processManager.get(
                                platformId,
                                msg.actor.id,
                                socket.id,
                                clientIp,
                            );
                        } catch (err) {
                            // e.g. limits.maxPlatformInstances reached
                            msg.error =
                                errorMessage(err) || "platform unavailable";
                            next(msg);
                            return;
                        }
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
                            msg.error =
                                errorMessage(err) || "platform unavailable";
                            next(msg);
                        }
                    },
                )
                .done(),
        );
    }
}

export default Sockethub;
