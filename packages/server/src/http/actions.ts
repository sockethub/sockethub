/**
 * HTTP actions endpoint.
 *
 * Accepts ActivityStreams via POST, streams NDJSON results as jobs complete,
 * and optionally caches results in Redis for idempotent replay + GET retrieval.
 */
import type { RedisConfig } from "@sockethub/data-layer";
import {
    CredentialsStore,
    type CredentialsStoreInterface,
    createIdempotencyRedisConnection,
    createRateLimitRedisConnection,
} from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import type {
    ActivityStream,
    InternalActivityStream,
} from "@sockethub/schemas";
import {
    buildCanonicalContext,
    ERROR_PLATFORM_CONTEXT_URL,
} from "@sockethub/schemas";
import { crypto } from "@sockethub/util/crypto";
import express, {
    type Express,
    type Request,
    type RequestHandler,
    type Response,
} from "express";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import config from "../config.js";
import { parseCorsOrigins, resolveAllowedOrigin } from "../cors.js";
import { createMessageHandlers } from "../message-handlers.js";
import type ProcessManager from "../process-manager.js";
import {
    registerHttpSession,
    unregisterHttpSession,
} from "./session-registry.js";

const log = createLogger("server:http:actions");

// Clients can supply a request id via either header or JSON body. This is used for idempotency.
const REQUEST_ID_HEADER = "x-request-id";
const SOCKETHUB_REQUEST_ID_HEADER = "x-sockethub-request-id";
// Keep HTTP actions off the Socket.IO path namespace (e.g. `/sockethub`) so
// Engine.IO does not intercept these HTTP requests.
const DEFAULT_HTTP_ACTIONS_PATH = "/sockethub-http";
// Redis keys are per request id. Keep list + status separate for replay + progress checks.
const IDEMPOTENCY_PREFIX = "sockethub:http-actions";
const IDEMPOTENCY_BATCH_SIZE = 100;
const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
// CORS: the endpoint is a browser-facing API, so it honors the same
// `sockethub:cors:origin` config that governs socket.io.
const CORS_ALLOWED_METHODS = "GET, POST, OPTIONS";
const CORS_ALLOWED_HEADERS =
    "Content-Type, X-Request-Id, X-Sockethub-Request-Id";
const CORS_EXPOSED_HEADERS = "X-Request-Id, X-Idempotent-Replay";

interface HttpActionsOptions {
    processManager: ProcessManager;
    parentId: string;
    parentSecret1: string;
}

interface HttpActionsDependencies {
    // Allow tests to inject light-weight fakes without wiring the full stack.
    getConfig?: (key: string) => unknown;
    // Build the route rate-limiter. Defaults to a Redis-backed express-rate-limit
    // so budgets are shared across instances; tests inject a pass-through.
    createRateLimiter?: (opts: {
        windowMs: number;
        max: number;
    }) => RequestHandler;
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

type PayloadKind = "credentials" | "message" | "unknown";

type PayloadEnvelope = {
    requestId?: string;
    messages?: Array<unknown>;
};

type RequestIdResolution = {
    error?: string;
    requestId?: string;
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
    // ActivityStream messages may identify their platform via context, @context, or platform.
    if ("type" in payload && "actor" in payload) {
        const typeValue = String(payload.type);
        if (typeValue === "credentials") {
            return "credentials";
        }
        return "message";
    }
    return "unknown";
}

/**
 * Build a minimal ActivityStreams-ish error payload for HTTP responses.
 */
function buildServerError(message: string, requestId?: string) {
    const payload: Record<string, unknown> = {
        type: "error",
        "@context": buildCanonicalContext(ERROR_PLATFORM_CONTEXT_URL),
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

function normalizeRequestId(value: unknown): RequestIdResolution {
    if (typeof value !== "string") {
        return {};
    }

    const requestId = value.trim();
    if (!requestId) {
        return {};
    }
    if (requestId.length > MAX_REQUEST_ID_LENGTH) {
        return {
            error: `requestId must be at most ${MAX_REQUEST_ID_LENGTH} characters`,
        };
    }
    if (!REQUEST_ID_PATTERN.test(requestId)) {
        return {
            error: "requestId contains invalid characters",
        };
    }
    return { requestId };
}

/**
 * Pull request id from headers or JSON body.
 */
function resolveRequestId(req: Request, body: unknown): RequestIdResolution {
    const headerId = normalizeRequestId(
        req.header(REQUEST_ID_HEADER) ??
            req.header(SOCKETHUB_REQUEST_ID_HEADER),
    );
    if (headerId.requestId || headerId.error) {
        return headerId;
    }
    if (isObject(body) && "requestId" in body) {
        const bodyRequestId = normalizeRequestId(body.requestId);
        if (bodyRequestId.requestId || bodyRequestId.error) {
            return bodyRequestId;
        }
    }
    return {};
}

/**
 * Pull request id from GET path/query first, then headers/body.
 */
function resolveRequestIdFromRequest(req: Request): RequestIdResolution {
    // GET endpoints may supply request id via path or query.
    const paramId = normalizeRequestId(
        typeof req.params?.requestId === "string"
            ? req.params.requestId
            : undefined,
    );
    if (paramId.requestId || paramId.error) {
        return paramId;
    }
    const queryId = normalizeRequestId(
        typeof req.query?.requestId === "string"
            ? req.query.requestId
            : undefined,
    );
    if (queryId.requestId || queryId.error) {
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

/**
 * CORS middleware for the HTTP actions routes, honoring the same
 * `sockethub:cors:origin` config that governs socket.io. Emits the allow
 * headers and answers preflight `OPTIONS` requests so browser clients on a
 * configured origin can call the endpoint.
 */
function createCorsMiddleware(
    getConfig: (key: string) => unknown,
): RequestHandler {
    // Parse the allow-list (and log any config warnings) once at route
    // registration rather than on every request.
    const allowedOrigins = parseCorsOrigins(
        getConfig("sockethub:cors:origin") as string | undefined,
    );
    return (req, res, next) => {
        const allowOrigin = resolveAllowedOrigin(
            allowedOrigins,
            req.headers.origin,
        );
        if (allowOrigin) {
            res.setHeader("Access-Control-Allow-Origin", allowOrigin);
            if (allowOrigin !== "*") {
                // Response varies by origin, so it must not be cached and served
                // to a different origin.
                res.setHeader("Vary", "Origin");
            }
        }
        res.setHeader("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
        res.setHeader("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
        res.setHeader("Access-Control-Expose-Headers", CORS_EXPOSED_HEADERS);
        res.setHeader("Access-Control-Max-Age", "600");
        if (req.method === "OPTIONS") {
            res.status(204).end();
            return;
        }
        next();
    };
}

function getIdempotencyRedisConnection() {
    // Keep HTTP idempotency on its own shared connection so credentials stores
    // retain their per-store connection naming and lifecycle.
    const redisConfig = config.get("redis") as RedisConfig;
    const connectionConfig: RedisConfig = {
        ...redisConfig,
        connectionName: "sockethub:http-actions:idempotency",
    };
    return createIdempotencyRedisConnection(connectionConfig);
}

/**
 * Build the default Redis-backed rate limiter for the HTTP actions routes.
 * A Redis store keeps per-IP budgets consistent across instances behind a load
 * balancer; the in-memory default only limits per process.
 */
function defaultRateLimiter(opts: { windowMs: number; max: number }) {
    const redisConfig = config.get("redis") as RedisConfig;
    const connection = createRateLimitRedisConnection({
        ...redisConfig,
        connectionName: "sockethub:http-actions:rate-limit",
    });
    return rateLimit({
        windowMs: opts.windowMs,
        max: opts.max,
        standardHeaders: true,
        legacyHeaders: false,
        store: new RedisStore({
            prefix: "sockethub:rate-limit:http-actions:",
            sendCommand: (...args: Array<string>) =>
                connection.call(args[0], ...args.slice(1)) as Promise<
                    number | string | null
                >,
        }),
    });
}

async function waitForRedisReady(
    redis: ReturnType<typeof getIdempotencyRedisConnection>,
) {
    const candidate = redis as {
        status?: string;
        connect?: () => Promise<unknown>;
        once?: (event: string, listener: (err?: unknown) => void) => void;
        off?: (event: string, listener: (err?: unknown) => void) => void;
    };

    // Test fakes may not expose connection lifecycle APIs.
    if (typeof candidate.status !== "string") {
        return;
    }
    if (candidate.status === "ready") {
        return;
    }
    if (
        candidate.status === "wait" &&
        typeof candidate.connect === "function"
    ) {
        await candidate.connect();
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const onReady = () => {
            candidate.off?.("error", onError);
            resolve();
        };
        const onError = (err?: unknown) => {
            candidate.off?.("ready", onReady);
            reject(err ?? new Error("redis connection failed"));
        };
        candidate.once?.("ready", onReady);
        candidate.once?.("error", onError);
    });
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
    const buildHandlers = deps.createMessageHandlers ?? createMessageHandlers;
    // The TTL is a crash backstop only: request cleanup explicitly tears the
    // key down, but a process crash mid-request would otherwise strand it.
    const credentialsTtlMs =
        Number(getConfig("credentials:ttlMs")) || undefined;
    const buildCredentialsStore =
        deps.createCredentialsStore ??
        ((parentId, sessionId, secret, redisConfig) =>
            new CredentialsStore(parentId, sessionId, secret, redisConfig, {
                ttlMs: credentialsTtlMs,
            }));
    const getIdempotencyRedis =
        deps.getIdempotencyRedisConnection ?? getIdempotencyRedisConnection;
    const buildRateLimiter = deps.createRateLimiter ?? defaultRateLimiter;

    const enabled = Boolean(getConfig("httpActions:enabled"));
    if (!enabled) {
        return;
    }

    const routePath =
        (getConfig("httpActions:path") as string) ?? DEFAULT_HTTP_ACTIONS_PATH;
    const requireRequestId =
        getConfig("httpActions:requireRequestId") !== false;
    const maxMessagesPerRequest = resolveConfigNumber(
        getConfig,
        "httpActions:maxMessagesPerRequest",
        20,
    );
    const maxPayloadBytes = resolveConfigNumber(
        getConfig,
        "httpActions:maxPayloadBytes",
        262144,
    );
    // Parse JSON only on this route. Keeping it off the global app means the
    // lenient `strict: false` (needed so primitive JSON reaches the handler and
    // gets a consistent error response) and the payload limit do not affect any
    // other route.
    const parseJson = express.json({
        limit: maxPayloadBytes,
        strict: false,
    });
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

    // Throttle HTTP actions per client IP, reusing the global rate limiter
    // window/max. Backed by Redis so budgets are shared across instances.
    const rateLimiterConfig = (getConfig("rateLimiter") ?? {}) as {
        windowMs?: number;
        maxRequests?: number;
    };
    const rateLimiter = buildRateLimiter({
        windowMs:
            typeof rateLimiterConfig.windowMs === "number"
                ? rateLimiterConfig.windowMs
                : 1000,
        max:
            typeof rateLimiterConfig.maxRequests === "number"
                ? rateLimiterConfig.maxRequests
                : 100,
    });

    const handleGet = async (req: Request, res: Response) => {
        // Allow retrying/late fetching of results by request id.
        const { requestId, error } = resolveRequestIdFromRequest(req);
        if (error) {
            res.status(400).json({ error });
            return;
        }
        if (!requestId) {
            res.status(400).json({
                error: "requestId is required",
            });
            return;
        }

        const idempotencyRedis = getIdempotencyRedis();
        const idempotencyKeys = buildIdempotencyKeys(requestId);

        try {
            await waitForRedisReady(idempotencyRedis);
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

    const cors = createCorsMiddleware(getConfig);
    // Preflight requests for both routes.
    app.options(routePath, cors);
    app.options(`${routePath}/:requestId`, cors);

    app.get(routePath, cors, rateLimiter, handleGet);
    app.get(`${routePath}/:requestId`, cors, rateLimiter, handleGet);

    app.post(
        routePath,
        cors,
        rateLimiter,
        parseJson,
        async (req: Request, res: Response) => {
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

            const { requestId: incomingRequestId, error: requestIdError } =
                resolveRequestId(req, req.body);
            if (requestIdError) {
                res.status(400).json({
                    error: requestIdError,
                });
                return;
            }
            if (!incomingRequestId && requireRequestId) {
                res.status(400).json({
                    error: "requestId is required",
                });
                return;
            }

            // If client provides request id, we enable idempotency. Otherwise, we run best-effort.
            // randId, not randToken: a server-minted request id is echoed in
            // headers/bodies and must satisfy REQUEST_ID_PATTERN, which
            // randToken's special characters would fail.
            const requestId = incomingRequestId ?? crypto.randId(16);
            const useIdempotency = Boolean(incomingRequestId);
            const idempotencyKeys = useIdempotency
                ? buildIdempotencyKeys(requestId)
                : undefined;
            const idempotencyRedis = useIdempotency
                ? getIdempotencyRedis()
                : undefined;

            if (useIdempotency && idempotencyRedis && idempotencyKeys) {
                try {
                    await waitForRedisReady(idempotencyRedis);
                    // Claim the request id. If already complete, replay cached results.
                    let claimed = Boolean(
                        await idempotencyRedis.set(
                            idempotencyKeys.statusKey,
                            "in-progress",
                            "PX",
                            idempotencyTtlMs,
                            "NX",
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
                                    "PX",
                                    idempotencyTtlMs,
                                    "NX",
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
            const sessionId = `http:${crypto.randId(16)}`;
            const sessionSecret = crypto.randToken(16);

            // Track which platform instances were touched so janitor
            // does not reap them mid-request.
            const platformIds = new Set<string>();

            const credentialsStore = buildCredentialsStore(
                options.parentId,
                sessionId,
                crypto.deriveSecret(options.parentSecret1, sessionSecret),
                getConfig("redis") as RedisConfig,
            );

            const handlers = buildHandlers({
                processManager: options.processManager,
                sessionId,
                sessionSecret,
                credentialsStore,
                onPlatformInstance: (platformInstance) => {
                    // Only persistent platforms need lifecycle tracking during
                    // HTTP-only requests.
                    if (!platformInstance.config.persist) {
                        return;
                    }
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
            let responseClosed = false;
            let requestTimeoutId: ReturnType<typeof setTimeout> | undefined;
            let idleTimeoutId: ReturnType<typeof setTimeout> | undefined;
            let completionStarted = false;
            let redisWriteChain = Promise.resolve();

            const cleanup = () => {
                for (const platformId of platformIds) {
                    unregisterHttpSession(platformId);
                }
                platformIds.clear();
                // This session id is single-use; drop its credential namespace
                // so it does not linger in Redis (SecureStore writes have no
                // TTL). Runs after all jobs have completed or the request has
                // timed out, so queued platform jobs already read the creds.
                // Fire-and-forget, but catch in case an implementation rejects.
                credentialsStore.teardown?.()?.catch((err: unknown) => {
                    log.error(
                        `credentials store teardown failed for ${sessionId}: ${String(err)}`,
                    );
                });
                if (requestTimeoutId) {
                    clearTimeout(requestTimeoutId);
                    requestTimeoutId = undefined;
                }
                if (idleTimeoutId) {
                    clearTimeout(idleTimeoutId);
                    idleTimeoutId = undefined;
                }
            };

            const completeRequest = () => {
                if (completionStarted) {
                    return;
                }
                completionStarted = true;

                const finish = () => {
                    cleanup();
                    closeResponse();
                };

                if (useIdempotency && idempotencyRedis && idempotencyKeys) {
                    // Finalize status only after all result lines are persisted
                    // so immediate retries can replay instead of racing 409.
                    redisWriteChain = redisWriteChain
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
                        })
                        .finally(finish);
                    return;
                }

                finish();
            };

            const closeResponse = () => {
                if (responseClosed) {
                    return;
                }
                responseClosed = true;
                if (!res.writableEnded) {
                    res.end();
                }
            };

            // Persist one NDJSON line to the idempotency list so a later GET can
            // replay the exact stream. Skipped once the request is finalized so a
            // late callback cannot grow the cached list past the finalized
            // response. Refreshes the list + status TTLs alongside each append.
            const persistLine = (serialized: string) => {
                if (
                    !useIdempotency ||
                    !idempotencyRedis ||
                    !idempotencyKeys ||
                    completionStarted
                ) {
                    return;
                }
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
            };

            // Timeout helpers keep request/idle timers consistent across the stream.
            const writeErrorLine = (message: string) => {
                if (responseClosed) {
                    return;
                }
                // Persist the error line too, so a replay matches what the client
                // streamed (e.g. a trailing "request timeout" line).
                const serialized = JSON.stringify(
                    buildServerError(message, requestId),
                );
                persistLine(serialized);
                res.write(`${serialized}\n`);
            };

            const scheduleRequestTimeout = () => {
                if (
                    !Number.isFinite(requestTimeoutMs) ||
                    requestTimeoutMs <= 0
                ) {
                    return;
                }
                requestTimeoutId = setTimeout(() => {
                    if (completionStarted) {
                        return;
                    }
                    writeErrorLine("request timeout");
                    completeRequest();
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
                    if (completionStarted) {
                        return;
                    }
                    writeErrorLine("request idle timeout");
                    completeRequest();
                }, idleTimeoutMs);
            };

            const writeResult = (result: unknown) => {
                // Normalize errors into ActivityStreams-ish error payloads for consistency.
                const output =
                    result instanceof Error
                        ? buildServerError(result.message, requestId)
                        : result;
                const serialized = JSON.stringify(output);

                persistLine(serialized);

                if (!responseClosed) {
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
                if (!responseClosed) {
                    log.debug(`http actions request closed early ${requestId}`);
                }
                // Keep platform-session tracking alive until queued jobs finish,
                // regardless of idempotency mode; only stop writing to the
                // response. Completing early here would unregister platforms via
                // cleanup() and let the janitor reap one mid-job. Timers still
                // bound how long processing continues after a disconnect.
                if (pending > 0) {
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
                    default:
                        writeResult(new Error("unsupported payload type"));
                        break;
                }
            });
        },
    );

    log.info(`http actions enabled at ${routePath}`);
}
