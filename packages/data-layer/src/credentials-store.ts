import {
    createLogger,
    getLoggerNamespace,
    type Logger,
} from "@sockethub/logger";
import type { CredentialsObject } from "@sockethub/schemas";
import { crypto } from "@sockethub/util/crypto";
import IORedis, { type Redis } from "ioredis";
import SecureStore from "secure-store-redis";

import { buildCredentialsStoreId } from "./queue-id.js";
import type { RedisConfig } from "./types.js";

let sharedCredentialsRedisConnection: Redis | null = null;
let sharedIdempotencyRedisConnection: Redis | null = null;
let sharedRateLimitRedisConnection: Redis | null = null;

function buildSharedRedisConnection(
    config: RedisConfig,
    opts: { enableOfflineQueue?: boolean } = {},
): Redis {
    return new IORedis(config.url, {
        connectionName: config.connectionName,
        // Credentials/idempotency fail fast when the socket isn't writable; the
        // rate limiter enables the offline queue so its eager script load queues
        // until the connection is ready instead of rejecting at construction.
        enableOfflineQueue: opts.enableOfflineQueue ?? false,
        maxRetriesPerRequest: config.maxRetriesPerRequest ?? null,
        connectTimeout: config.connectTimeout ?? 10000,
        disconnectTimeout: config.disconnectTimeout ?? 5000,
        lazyConnect: false,
        // Every shared connection must recover on its own after a Redis
        // restart/failover: commands already fail fast while disconnected
        // (offline queue disabled or used only for eager script loads), but if
        // the retry strategy ever gives up, ioredis stops reconnecting and the
        // connection stays dead until the process restarts. Keep retrying with
        // a capped backoff.
        retryStrategy: (times: number) =>
            Math.min(2 ** Math.min(times - 1, 5) * 200, 5000),
    });
}

/**
 * Creates or returns a shared Redis connection for CredentialsStore instances.
 * This prevents connection exhaustion by reusing a single connection across
 * all credential storage operations.
 *
 * @param config - Redis configuration
 * @returns Shared Redis connection instance
 */
export function createCredentialsRedisConnection(config: RedisConfig): Redis {
    if (!sharedCredentialsRedisConnection) {
        sharedCredentialsRedisConnection = buildSharedRedisConnection(config);
    }
    return sharedCredentialsRedisConnection;
}

/**
 * Creates or returns a dedicated shared Redis connection for HTTP idempotency.
 */
export function createIdempotencyRedisConnection(config: RedisConfig): Redis {
    if (!sharedIdempotencyRedisConnection) {
        sharedIdempotencyRedisConnection = buildSharedRedisConnection(config);
    }
    return sharedIdempotencyRedisConnection;
}

/**
 * Creates or returns a dedicated shared Redis connection for rate limiting.
 * A dedicated connection keeps rate-limit traffic off the credentials and
 * idempotency connections and lets a Redis-backed limiter share request budgets
 * across instances.
 */
export function createRateLimitRedisConnection(config: RedisConfig): Redis {
    if (!sharedRateLimitRedisConnection) {
        sharedRateLimitRedisConnection = buildSharedRedisConnection(config, {
            enableOfflineQueue: true,
        });
    }
    return sharedRateLimitRedisConnection;
}

/**
 * Resets the shared credentials Redis connection. Used primarily for testing.
 */
export async function resetSharedCredentialsRedisConnection(): Promise<void> {
    if (sharedCredentialsRedisConnection) {
        try {
            sharedCredentialsRedisConnection.disconnect(false);
        } catch (_err) {
            // Ignore disconnect errors during cleanup
        }
        sharedCredentialsRedisConnection = null;
    }
}

export async function resetSharedIdempotencyRedisConnection(): Promise<void> {
    if (sharedIdempotencyRedisConnection) {
        try {
            sharedIdempotencyRedisConnection.disconnect(false);
        } catch (_err) {
            // Ignore disconnect errors during cleanup
        }
        sharedIdempotencyRedisConnection = null;
    }
}

export async function resetSharedRateLimitRedisConnection(): Promise<void> {
    if (sharedRateLimitRedisConnection) {
        try {
            sharedRateLimitRedisConnection.disconnect(false);
        } catch (_err) {
            // Ignore disconnect errors during cleanup
        }
        sharedRateLimitRedisConnection = null;
    }
}

export interface CredentialsStoreInterface {
    get(
        actor: string,
        credentialsHash?: string,
        options?: CredentialsValidationOptions,
    ): Promise<CredentialsObject | undefined>;
    save(actor: string, creds: CredentialsObject): Promise<number>;
    /**
     * Delete this session's entire credential namespace from Redis. Used by
     * single-use sessions (e.g. HTTP actions requests) whose credentials are
     * never read again once the request completes. Optional: long-lived socket
     * sessions do not implement it.
     */
    teardown?(): Promise<void>;
}

export interface CredentialsStoreOptions {
    /**
     * Sliding time-to-live in milliseconds applied to this session's
     * credential key in Redis, refreshed on every save and read. A backstop
     * against keys orphaned by crashes or ungraceful shutdowns where explicit
     * teardown never runs — size it generously (idle sessions do not refresh
     * it). Omit or 0 to disable expiry.
     */
    ttlMs?: number;
}

export interface CredentialsValidationOptions {
    /**
     * Enables stricter checks used only when trying to attach a second socket
     * session to an already-running actor-scoped platform instance.
     */
    validateSessionShare?: boolean;
}

export class CredentialsMismatchError extends Error {
    constructor(message: string) {
        super(message);
        // Keep the legacy "Error: ..." string shape in existing callers/tests.
        this.name = "Error";
    }
}

export class CredentialsNotShareableError extends Error {
    constructor(message: string) {
        super(message);
        // Keep the legacy "Error: ..." string shape in existing callers/tests.
        this.name = "Error";
    }
}

export async function verifySecureStore(config: RedisConfig): Promise<void> {
    const log = createLogger("data-layer:verify-secure-store");
    const sharedClient = createCredentialsRedisConnection(config);
    const ss = new SecureStore({
        uid: "data-layer:verify",
        secret: "aB3#xK9mP2qR7wZ4cT8nY6vH1jL5fD0s",
        redis: { client: sharedClient },
    });
    await ss.connect();
    await ss.disconnect();
    log.info("secure store connection verified");
}

/**
 * Secure, encrypted storage for user credentials with session-based isolation.
 *
 * Provides automatic encryption/decryption of credential objects stored in Redis,
 * ensuring that sensitive authentication data is never stored in plaintext.
 * Each session gets its own isolated credential store.
 *
 * @example
 * ```typescript
 * const store = new CredentialsStore('session123', secret, redisConfig);
 *
 * // Store credentials
 * await store.save('user@example.com', {
 *   username: 'user',
 *   password: 'secret',
 *   server: 'irc.freenode.net'
 * });
 *
 * // Retrieve credentials
 * const creds = await store.get('user@example.com', credentialsHash);
 * ```
 */
export class CredentialsStore implements CredentialsStoreInterface {
    readonly uid: string;
    store: SecureStore;
    objectHash: (o: unknown) => string;
    private readonly log: Logger;

    /**
     * Creates a new CredentialsStore instance.
     *
     * @param parentId - Unique identifier for the parent instance (e.g. server ID)
     * @param sessionId - Client session identifier for credential isolation
     * @param secret - 32-character encryption secret for credential security
     * @param redisConfig - Redis connection configuration
     * @throws Error if secret is not exactly 32 characters
     */
    constructor(
        parentId: string,
        sessionId: string,
        secret: string,
        redisConfig: RedisConfig,
        options: CredentialsStoreOptions = {},
    ) {
        if (secret.length !== 32) {
            throw new Error(
                "CredentialsStore secret must be 32 chars in length",
            );
        }
        // Create logger with full namespace (context will be prepended automatically)
        this.log = createLogger(
            `data-layer:credentials-store:${parentId}:${sessionId}`,
        );

        this.initCrypto();

        // Use the canonical, context-free namespace for credentials storage keys
        this.uid = buildCredentialsStoreId(parentId, sessionId);
        // Keep full logger namespace for Redis connection naming
        redisConfig.connectionName = getLoggerNamespace(this.log);
        this.initSecureStore(secret, redisConfig, options.ttlMs);
        this.log.debug("initialized");
    }

    initCrypto() {
        this.objectHash = crypto.objectHash;
    }

    initSecureStore(secret: string, redisConfig: RedisConfig, ttlMs?: number) {
        // Use shared Redis connection for connection pooling
        const sharedClient = createCredentialsRedisConnection(redisConfig);
        this.store = new SecureStore({
            uid: this.uid,
            secret: secret,
            redis: { client: sharedClient },
            // Sliding expiry: refreshed by SecureStore on every save and get.
            ...(ttlMs ? { ttl: ttlMs } : {}),
        });
    }

    /**
     * Gets the credentials for a given actor ID.
     * @param actor
     * @param credentialsHash - Optional hash to validate credentials.
     *   If undefined, validation is skipped.
     */
    async get(
        actor: string,
        credentialsHash?: string,
        options: CredentialsValidationOptions = {},
    ): Promise<CredentialsObject> {
        this.log.debug(`get credentials for ${actor}`);
        if (!this.store.isConnected) {
            await this.store.connect();
        }
        const credentials: CredentialsObject = await this.store.get(actor);
        if (!credentials) {
            throw new Error(`credentials not found for ${actor}`);
        }
        if (
            !credentials.object ||
            typeof credentials.object !== "object" ||
            Array.isArray(credentials.object) ||
            Object.keys(credentials.object).length === 0
        ) {
            throw new CredentialsMismatchError(
                `invalid credentials for ${actor}`,
            );
        }

        if (credentialsHash) {
            // If a hash is provided, credentials must match exactly. This blocks
            // "same actor, different credentials" reuse attempts.
            if (credentialsHash !== this.objectHash(credentials.object)) {
                throw new CredentialsMismatchError(
                    `invalid credentials for ${actor}`,
                );
            }
        }

        if (options.validateSessionShare) {
            const password = credentials.object.password;
            const token = credentials.object.token;
            const hasPassword =
                typeof password === "string" && password.length > 0;
            const hasToken = typeof token === "string" && token.length > 0;

            // Credentials must include a non-empty secret before an additional
            // session can attach to the same persistent actor instance.
            if (!hasPassword && !hasToken) {
                throw new CredentialsNotShareableError(
                    "username already in use",
                );
            }
        }
        return credentials;
    }

    /**
     * Saves the credentials for a given actor ID
     * @param actor
     * @param creds
     */
    async save(actor: string, creds: CredentialsObject): Promise<number> {
        if (!this.store.isConnected) {
            await this.store.connect();
        }
        return await this.store.save(actor, creds);
    }

    /**
     * Delete this session's entire credential hash from Redis, promptly
     * reclaiming the key instead of waiting for its TTL (if any) to lapse.
     * Called when the session ends (socket disconnect, HTTP actions request
     * cleanup). Best-effort and safe to call when nothing was stored — a
     * missing key is a no-op.
     */
    async teardown(): Promise<void> {
        try {
            if (!this.store.isConnected) {
                await this.store.connect();
            }
            await this.store.deleteAll();
        } catch (err) {
            this.log.debug(`credential store teardown failed: ${err}`);
        }
    }
}

/**
 * Escape Redis glob special characters so a string is matched literally by
 * SCAN's MATCH option. parentId is generated from a charset that includes
 * `*` — unescaped, a hostile-luck token could make the purge pattern match
 * (and delete) other instances' keys.
 */
function escapeRedisGlob(value: string): string {
    return value.replace(/[\\*?[\]]/g, "\\$&");
}

/**
 * Delete every credential-store key belonging to `parentId`. Called from
 * server shutdown so an instance reclaims its own keys instead of stranding
 * them under a parentId that no future boot will ever reference (each boot
 * randomizes its parentId). Scoped strictly to the given parentId: Redis may
 * be shared by multiple running instances, so keys under other parentIds are
 * never touched. Returns the number of keys removed.
 */
export async function purgeCredentialsStoreKeys(
    client: Redis,
    parentId: string,
): Promise<number> {
    const pattern = `${escapeRedisGlob(buildCredentialsStoreId(parentId, ""))}*`;
    let cursor = "0";
    let removed = 0;
    do {
        const [nextCursor, keys] = await client.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
            removed += await client.del(...keys);
        }
    } while (cursor !== "0");
    return removed;
}

/**
 * Convenience wrapper over {@link purgeCredentialsStoreKeys} using the shared
 * credentials Redis connection.
 */
export async function purgeCredentialsStores(
    parentId: string,
    config: RedisConfig,
): Promise<number> {
    return purgeCredentialsStoreKeys(
        createCredentialsRedisConnection(config),
        parentId,
    );
}
