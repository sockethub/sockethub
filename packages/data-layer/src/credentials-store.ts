import { crypto } from "@sockethub/crypto";
import {
    type Logger,
    createLogger,
    getLoggerNamespace,
} from "@sockethub/logger";
import type { CredentialsObject } from "@sockethub/schemas";
import IORedis, { type Redis } from "ioredis";
import SecureStore from "secure-store-redis";

import { buildCredentialsStoreId } from "./queue-id.js";
import type { RedisConfig } from "./types.js";

let sharedCredentialsRedisConnection: Redis | null = null;

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
        sharedCredentialsRedisConnection = new IORedis(config.url, {
            connectionName: config.connectionName,
            enableOfflineQueue: false,
            maxRetriesPerRequest: config.maxRetriesPerRequest ?? null,
            connectTimeout: config.connectTimeout ?? 10000,
            disconnectTimeout: config.disconnectTimeout ?? 5000,
            lazyConnect: false,
            retryStrategy: (times: number) => {
                if (times > 3) return null;
                return Math.min(2 ** (times - 1) * 200, 2000);
            },
        });
    }
    return sharedCredentialsRedisConnection;
}

/**
 * Resets the shared credentials Redis connection. Used primarily for testing.
 */
export async function resetSharedCredentialsRedisConnection(): Promise<void> {
    if (sharedCredentialsRedisConnection) {
        try {
            sharedCredentialsRedisConnection.disconnect(false);
        } catch (err) {
            // Ignore disconnect errors during cleanup
        }
        sharedCredentialsRedisConnection = null;
    }
}

export interface CredentialsStoreInterface {
    get(
        actor: string,
        credentialsHash: string | undefined,
    ): Promise<CredentialsObject | undefined>;
    save(actor: string, creds: CredentialsObject): Promise<number>;
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

        // Use context-free namespace for credentials storage keys
        this.uid = buildCredentialsStoreId(parentId, sessionId);
        // Keep full logger namespace for Redis connection naming
        redisConfig.connectionName = getLoggerNamespace(this.log);
        this.initSecureStore(secret, redisConfig);
        this.log.debug("initialized");
    }

    initCrypto() {
        this.objectHash = crypto.objectHash;
    }

    initSecureStore(secret: string, redisConfig: RedisConfig) {
        // Use shared Redis connection for connection pooling
        const sharedClient = createCredentialsRedisConnection(redisConfig);
        this.store = new SecureStore({
            uid: this.uid,
            secret: secret,
            redis: { client: sharedClient },
        });
    }

    /**
     * Gets the credentials for a given actor ID
     * @param actor
     * @param credentialsHash - Optional hash to validate credentials. If undefined, validation is skipped.
     */
    async get(
        actor: string,
        credentialsHash: string | undefined,
    ): Promise<CredentialsObject> {
        this.log.debug(`get credentials for ${actor}`);
        if (!this.store.isConnected) {
            await this.store.connect();
        }
        const credentials: CredentialsObject = await this.store.get(actor);
        if (!credentials) {
            throw new Error(`credentials not found for ${actor}`);
        }

        if (credentialsHash) {
            if (credentialsHash !== this.objectHash(credentials.object)) {
                throw new Error(`invalid credentials for ${actor}`);
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
        return this.store.save(actor, creds);
    }
}
