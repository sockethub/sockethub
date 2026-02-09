/**
 * HTTP actions endpoint.
 *
 * Accepts ActivityStreams via POST, streams NDJSON results as jobs complete,
 * and optionally caches results in Redis for idempotent replay + GET retrieval.
 */
import { crypto } from "@sockethub/crypto";
import type { RedisConfig } from "@sockethub/data-layer";
import {
    CredentialsStore,
    type CredentialsStoreInterface,
    createCredentialsRedisConnection,
} from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import type {
    ActivityObject,
    ActivityStream,
    InternalActivityStream,
} from "@sockethub/schemas";
import type { Express, Request, Response } from "express";
import config from "../config.js";
import { createMessageHandlers } from "../message-handlers.js";
import type ProcessManager from "../process-manager.js";
import { createHttpRateLimiter } from "../rate-limiter.js";
import {
    registerHttpSession,
    unregisterHttpSession,
} from "./session-registry.js";

const log = createLogger("server:http:actions");

// Clients can supply a request id via either header or JSON body. This is used for idempotency.
const REQUEST_ID_HEADER = "x-request-id";
const SOCKETHUB_REQUEST_ID_HEADER = "x-sockethub-request-id";
// Redis keys are per request id. Keep list + status separate for replay + progress checks.
const IDEMPOTENCY_PREFIX = "sockethub:http-actions";
const IDEMPOTENCY_BATCH_SIZE = 100;

interface HttpActionsOptions {
    processManager: ProcessManager;
    parentId: string;
    parentSecret1: string;
}

interface HttpActionsDependencies {
    // Allow tests to inject light-weight fakes without wiring the full stack.
    getConfig?: (key: string) => unknown;
    createHttpRateLimiter?: typeof createHttpRateLimiter;
    createMessageHandlers?: typeof createMessageHandlers;
    createCredentialsStore?: (
        parentId: string,
        sessionId: string,
        secret: string,
        redisConfig: RedisConfig,
    ) => CredentialsStoreInterface;
    getIdempotencyRedisConnection?: () => ReturnType<
        typeof getIdempotencyRedisConnection
    >;
}

type PayloadKind = "credentials" | "message" | "activity-object" | "unknown";

type PayloadEnvelope = {
    requestId?: string;
    messages?: Array<unknown>;
};

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * Categorize a payload so we can route it into the shared handler chain.
 */
function classifyPayload(payload: unknown): PayloadKind {
    if (!isObject(payload)) {
        return "unknown";
    }
    // ActivityStream has context/type/actor. Credentials is a special case of ActivityStream.
    if ("context" in payload && "type" in payload && "actor" in payload) {
        const typeValue = String(payload.type);
        if (typeValue === "credentials") {
            return "credentials";
        }
        return "message";
    }
    // ActivityObject has only "object" at top-level.
    if ("object" in payload) {
        return "activity-object";
    }
    return "unknown";
}

/**
 * Build a minimal ActivityStreams-ish error payload for HTTP responses.
 */
function buildServerError(message: string, requestId?: string) {
    const payload: Record<string, unknown> = {
        type: "error",
        context: "error",
        actor: {
            type: "Application",
            name: "sockethub-server",
        },
        error: message,
    };
    if (requestId) {
        payload.requestId = requestId;
    }
    return payload;
}

/**
 * Pull request id from headers or JSON body.
 */
function resolveRequestId(req: Request, body: unknown) {
    const headerId =
        req.header(REQUEST_ID_HEADER) ??
        req.header(SOCKETHUB_REQUEST_ID_HEADER);
    if (headerId) {
        return headerId;
    }
    if (isObject(body) && "requestId" in body) {
        const value = body.requestId;
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
    }
    return undefined;
}

/**
 * Pull request id from GET path/query first, then headers/body.
 */
function resolveRequestIdFromRequest(req: Request) {
    // GET endpoints may supply request id via path or query.
    const paramId =
        typeof req.params?.requestId === "string"
            ? req.params.requestId
            : undefined;
    if (paramId) {
        return paramId;
    }
    const queryId =
        typeof req.query?.requestId === "string"
            ? req.query.requestId
            : undefined;
    if (queryId) {
        return queryId;
    }
    return resolveRequestId(req, req.body);
}

/**
 * Normalize request body into a payload array.
 */
function normalizePayloads(body: unknown): Array<unknown> {
    if (Array.isArray(body)) {
        return body;
    }
    if (isObject(body) && Array.isArray((body as PayloadEnvelope).messages)) {
        return (body as PayloadEnvelope).messages ?? [];
    }
    if (isObject(body)) {
        return [body];
    }
    return [];
}

/**
 * Resolve a numeric config value, allowing env-style string numbers.
 */
function resolveConfigNumber(
    getConfig: (key: string) => unknown,
    key: string,
    fallback: number,
) {
    const value = getConfig(key);
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return fallback;
}

function getIdempotencyRedisConnection() {
    // Share a Redis connection to avoid per-request churn.
    const redisConfig = config.get("redis") as RedisConfig;
    const connectionConfig: RedisConfig = {
        ...redisConfig,
        connectionName: "sockethub:http-actions:idempotency",
    };
    return createCredentialsRedisConnection(connectionConfig);
}

function buildIdempotencyKeys(requestId: string) {
    // Status tracks in-progress/complete; list stores NDJSON lines in order of completion.
    return {
        statusKey: `${IDEMPOTENCY_PREFIX}:status:${requestId}`,
        listKey: `${IDEMPOTENCY_PREFIX}:results:${requestId}`,
    };
}

async function streamCachedResults(
    res: Response,
    requestId: string,
    listKey: string,
    redis: ReturnType<typeof getIdempotencyRedisConnection>,
) {
    res.status(200);
    // Stream cached NDJSON back to the caller. This replays the original response.
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Idempotent-Replay", "true");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let start = 0;
    while (true) {
        const batch = await redis.lrange(
            listKey,
            start,
            start + IDEMPOTENCY_BATCH_SIZE - 1,
        );
        if (!batch.length) {
            break;
        }
        for (const item of batch) {
            res.write(`${item}\n`);
        }
        if (batch.length < IDEMPOTENCY_BATCH_SIZE) {
            break;
        }
        start += batch.length;
    }
    res.end();
}

export function registerHttpActionsRoutes(
    app: Express,
    options: HttpActionsOptions,
    deps: HttpActionsDependencies = {},
) {
    const getConfig = deps.getConfig ?? ((key: string) => config.get(key));
    const createLimiter = deps.createHttpRateLimiter ?? createHttpRateLimiter;
    const buildHandlers = deps.createMessageHandlers ?? createMessageHandlers;
    const buildCredentialsStore =
        deps.createCredentialsStore ??
        ((parentId, sessionId, secret, redisConfig) =>
            new CredentialsStore(parentId, sessionId, secret, redisConfig));
    const getIdempotencyRedis =
        deps.getIdempotencyRedisConnection ?? getIdempotencyRedisConnection;

    const enabled = Boolean(getConfig("httpActions:enabled"));
    if (!enabled) {
        return;
    }

    const routePath =
        (getConfig("httpActions:path") as string) ?? "/sockethub/http";
    const requireRequestId =
        getConfig("httpActions:requireRequestId") !== false;
    const maxMessagesPerRequest = resolveConfigNumber(
        getConfig,
        "httpActions:maxMessagesPerRequest",
        20,
    );
    const idempotencyTtlMsCandidate = resolveConfigNumber(
        getConfig,
        "httpActions:idempotencyTtlMs",
        300000,
    );
    const idempotencyTtlMs =
        idempotencyTtlMsCandidate > 0 ? idempotencyTtlMsCandidate : 300000;
    const requestTimeoutMs = resolveConfigNumber(
        getConfig,
        "httpActions:requestTimeoutMs",
        30000,
    );
    const idleTimeoutMs = resolveConfigNumber(
        getConfig,
        "httpActions:idleTimeoutMs",
        15000,
    );

    // Reuse the global rate limiter config for HTTP requests (keyed by IP).
    const rateLimiterConfig: Parameters<typeof createHttpRateLimiter>[0] =
        (getConfig("rateLimiter") ?? {}) as Parameters<
            typeof createHttpRateLimiter
        >[0];
    const rateLimiter = createLimiter(rateLimiterConfig);

    const handleGet = async (req: Request, res: Response) => {
        // Allow retrying/late fetching of results by request id.
        const requestId = resolveRequestIdFromRequest(req);
        if (!requestId) {
            res.status(400).json({
                error: "requestId is required",
            });
            return;
        }

        const idempotencyRedis = getIdempotencyRedis();
        const idempotencyKeys = buildIdempotencyKeys(requestId);

        try {
            const status = await idempotencyRedis.get(
                idempotencyKeys.statusKey,
            );
            if (status === "complete") {
                await streamCachedResults(
                    res,
                    requestId,
                    idempotencyKeys.listKey,
                    idempotencyRedis,
                );
                return;
            }
            if (status === "in-progress") {
                res.status(202).json({
                    status: "in-progress",
                    requestId,
                });
                return;
            }
            res.status(404).json({
                error: "request not found",
                requestId,
            });
        } catch (err) {
            log.error(
                `idempotency lookup error for ${requestId}: ${String(err)}`,
            );
            res.status(503).json({
                error: "idempotency store unavailable",
            });
        }
    };

    app.get(routePath, rateLimiter, handleGet);
    app.get(`${routePath}/:requestId`, rateLimiter, handleGet);

    app.post(routePath, rateLimiter, async (req: Request, res: Response) => {
        const payloads = normalizePayloads(req.body);
        if (payloads.length === 0) {
            res.status(400).json({
                error: "request body must be a payload object or array of payloads",
            });
            return;
        }
        if (payloads.length > maxMessagesPerRequest) {
            res.status(413).json({
                error: `payload limit exceeded (max ${maxMessagesPerRequest})`,
            });
            return;
        }

        const incomingRequestId = resolveRequestId(req, req.body);
        if (!incomingRequestId && requireRequestId) {
            res.status(400).json({
                error: "requestId is required",
            });
            return;
        }

        // If client provides request id, we enable idempotency. Otherwise, we run best-effort.
        const requestId = incomingRequestId ?? crypto.randToken(16);
        const useIdempotency = Boolean(incomingRequestId);
        const idempotencyKeys = useIdempotency
            ? buildIdempotencyKeys(requestId)
            : undefined;
        const idempotencyRedis = useIdempotency
            ? getIdempotencyRedis()
            : undefined;

        if (useIdempotency && idempotencyRedis && idempotencyKeys) {
            try {
                // Claim the request id. If already complete, replay cached results.
                let claimed = Boolean(
                    await idempotencyRedis.set(
                        idempotencyKeys.statusKey,
                        "in-progress",
                        "NX",
                        "PX",
                        idempotencyTtlMs,
                    ),
                );
                if (!claimed) {
                    const status = await idempotencyRedis.get(
                        idempotencyKeys.statusKey,
                    );
                    if (status === "complete") {
                        await streamCachedResults(
                            res,
                            requestId,
                            idempotencyKeys.listKey,
                            idempotencyRedis,
                        );
                        return;
                    }
                    if (!status) {
                        claimed = Boolean(
                            await idempotencyRedis.set(
                                idempotencyKeys.statusKey,
                                "in-progress",
                                "NX",
                                "PX",
                                idempotencyTtlMs,
                            ),
                        );
                    }
                    if (!claimed) {
                        res.status(409).json({
                            error: "request already in progress",
                            requestId,
                        });
                        return;
                    }
                }
                // Clear any stale list and ensure TTL is set for the new run.
                await idempotencyRedis.del(idempotencyKeys.listKey);
                await idempotencyRedis.pexpire(
                    idempotencyKeys.listKey,
                    idempotencyTtlMs,
                );
            } catch (err) {
                log.error(
                    `idempotency store error for ${requestId}: ${String(err)}`,
                );
                res.status(503).json({
                    error: "idempotency store unavailable",
                });
                return;
            }
        }
        // Create a server-side session id for internal routing only.
        const sessionId = `http:${crypto.randToken(16)}`;
        const sessionSecret = crypto.randToken(16);

        const credentialsStore = buildCredentialsStore(
            options.parentId,
            sessionId,
            crypto.deriveSecret(options.parentSecret1, sessionSecret),
            getConfig("redis") as RedisConfig,
        );

        // Track which platform instances were touched so janitor doesn't kill them mid-request.
        const platformIds = new Set<string>();
        const handlers = buildHandlers({
            processManager: options.processManager,
            sessionId,
            sessionSecret,
            credentialsStore,
            onPlatformInstance: (platformInstance) => {
                if (!platformIds.has(platformInstance.id)) {
                    platformIds.add(platformInstance.id);
                    registerHttpSession(platformInstance.id);
                }
            },
        });

        // Stream NDJSON so callers can process results as they arrive.
        res.status(200);
        res.setHeader("Content-Type", "application/x-ndjson");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("X-Request-Id", requestId);
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        let pending = payloads.length;
        let closed = false;
        let requestTimeoutId: Timer;
        let idleTimeoutId: Timer;
        let completionFinalized = false;
        let redisWriteChain = Promise.resolve();

        const cleanup = () => {
            for (const platformId of platformIds) {
                unregisterHttpSession(platformId);
            }
            platformIds.clear();
            if (requestTimeoutId) {
                clearTimeout(requestTimeoutId);
                requestTimeoutId = undefined;
            }
            if (idleTimeoutId) {
                clearTimeout(idleTimeoutId);
                idleTimeoutId = undefined;
            }
        };

        const finalizeCompletion = () => {
            if (completionFinalized) {
                return;
            }
            completionFinalized = true;
            if (useIdempotency && idempotencyRedis && idempotencyKeys) {
                // Finalize status after all results have been persisted to Redis.
                void redisWriteChain
                    .catch(() => {
                        // handled in chain
                    })
                    .then(() =>
                        idempotencyRedis.set(
                            idempotencyKeys.statusKey,
                            "complete",
                            "PX",
                            idempotencyTtlMs,
                        ),
                    )
                    .catch((err) => {
                        log.error(
                            `failed to finalize idempotency for ${requestId}: ${String(
                                err,
                            )}`,
                        );
                    });
            }
        };

        const closeResponse = () => {
            if (closed) {
                return;
            }
            closed = true;
            if (!res.writableEnded) {
                res.end();
            }
        };

        const completeRequest = () => {
            finalizeCompletion();
            cleanup();
            closeResponse();
        };

        // Timeout helpers keep request/idle timers consistent across the stream.
        const writeErrorLine = (message: string) => {
            if (closed) {
                return;
            }
            res.write(
                `${JSON.stringify(buildServerError(message, requestId))}\n`,
            );
        };

        const scheduleRequestTimeout = () => {
            if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
                return;
            }
            requestTimeoutId = setTimeout(() => {
                if (!closed) {
                    writeErrorLine("request timeout");
                    completeRequest();
                }
            }, requestTimeoutMs);
        };

        const scheduleIdleTimeout = () => {
            if (idleTimeoutId) {
                clearTimeout(idleTimeoutId);
            }
            if (!Number.isFinite(idleTimeoutMs) || idleTimeoutMs <= 0) {
                return;
            }
            idleTimeoutId = setTimeout(() => {
                if (!closed) {
                    writeErrorLine("request idle timeout");
                    completeRequest();
                }
            }, idleTimeoutMs);
        };

        const writeResult = (result: unknown) => {
            // Normalize errors into ActivityStreams-ish error payloads for consistency.
            const output =
                result instanceof Error
                    ? buildServerError(result.message, requestId)
                    : result;
            const serialized = JSON.stringify(output);

            if (useIdempotency && idempotencyRedis && idempotencyKeys) {
                // Persist each line so a later GET can replay the response.
                redisWriteChain = redisWriteChain
                    .then(() =>
                        idempotencyRedis.rpush(
                            idempotencyKeys.listKey,
                            serialized,
                        ),
                    )
                    .then(() =>
                        idempotencyRedis.pexpire(
                            idempotencyKeys.listKey,
                            idempotencyTtlMs,
                        ),
                    )
                    .then(() =>
                        idempotencyRedis.pexpire(
                            idempotencyKeys.statusKey,
                            idempotencyTtlMs,
                        ),
                    )
                    .catch((err) => {
                        log.error(
                            `failed to persist idempotency result for ${requestId}: ${String(
                                err,
                            )}`,
                        );
                    });
            }

            if (!closed) {
                res.write(`${serialized}\n`);
            }
            pending -= 1;
            if (pending <= 0) {
                completeRequest();
                return;
            }
            scheduleIdleTimeout();
        };

        scheduleRequestTimeout();
        scheduleIdleTimeout();

        req.on("close", () => {
            if (!closed) {
                log.debug(`http actions request closed early ${requestId}`);
            }
            // If the client disconnected but idempotency is enabled, keep processing
            // and let the caller fetch results later via GET.
            if (useIdempotency && pending > 0) {
                closeResponse();
                return;
            }
            completeRequest();
        });

        payloads.forEach((payload) => {
            const kind = classifyPayload(payload);
            switch (kind) {
                case "credentials":
                    handlers.credentials(
                        payload as ActivityStream,
                        writeResult,
                    );
                    break;
                case "message":
                    handlers.message(
                        payload as InternalActivityStream,
                        writeResult,
                    );
                    break;
                case "activity-object":
                    handlers.activityObject(
                        payload as ActivityObject,
                        writeResult,
                    );
                    break;
                default:
                    writeResult(new Error("unsupported payload type"));
                    break;
            }
        });
    });

    log.info(`http actions enabled at ${routePath}`);
}
