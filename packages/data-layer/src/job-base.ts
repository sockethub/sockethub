import EventEmitter from "node:events";
import IORedis, { type Redis } from "ioredis";

import { crypto, type Crypto } from "@sockethub/crypto";
import type { ActivityStream } from "@sockethub/schemas";

import type { JobDataDecrypted, JobEncrypted, RedisConfig } from "./types.js";

let sharedRedisConnection: Redis | null = null;

/**
 * Creates or returns a shared Redis connection to enable connection pooling.
 * This prevents connection exhaustion under high load by reusing a single
 * connection across all JobQueue and JobWorker instances.
 *
 * @param config - Redis configuration with optional timeout and retry settings
 * @returns Shared Redis connection instance
 */
export function createIORedisConnection(config: RedisConfig): Redis {
    if (!sharedRedisConnection) {
        sharedRedisConnection = new IORedis(config.url, {
            connectionName: config.connectionName,
            enableOfflineQueue: false,
            maxRetriesPerRequest: config.maxRetriesPerRequest ?? null,
            connectTimeout: config.connectTimeout ?? 10000,
            disconnectTimeout: config.disconnectTimeout ?? 5000,
            lazyConnect: false,
            retryStrategy: (times: number) => {
                // Stop retrying after 3 attempts to fail fast
                if (times > 3) return null;
                // Exponential backoff: 200ms, 400ms, 800ms
                return Math.min(2 ** (times - 1) * 200, 2000);
            },
        });
    }
    return sharedRedisConnection;
}

/**
 * Resets the shared Redis connection. Used primarily for testing.
 * Disconnects the current connection before resetting.
 */
export async function resetSharedRedisConnection(): Promise<void> {
    if (sharedRedisConnection) {
        try {
            sharedRedisConnection.disconnect(false);
        } catch (err) {
            // Ignore disconnect errors during cleanup
        }
        sharedRedisConnection = null;
    }
}

/**
 * Gets the total number of active Redis client connections.
 *
 * Note: This queries the Redis server directly using CLIENT LIST and reports
 * ALL active connections to the Redis instance. This includes connections from
 * Sockethub (BullMQ queues, workers, and the shared connection) as well as any
 * other applications or services connected to the same Redis server.
 *
 * @returns Number of active Redis connections, or 0 if no connection exists
 */
export async function getRedisConnectionCount(): Promise<number> {
    if (!sharedRedisConnection) {
        return 0;
    }

    try {
        const clientList = (await sharedRedisConnection.client(
            "LIST",
        )) as string;
        // CLIENT LIST returns one line per connection, filter out empty lines
        const connections = clientList
            .split("\n")
            .filter((line: string) => line.trim());
        return connections.length;
    } catch (err) {
        // Return 0 if Redis query fails (connection issues, etc.)
        return 0;
    }
}

export class JobBase extends EventEmitter {
    protected crypto: Crypto;
    private readonly secret: string;

    constructor(secret: string) {
        super();
        if (secret.length !== 32) {
            throw new Error(
                `secret must be a 32 char string, length: ${secret.length}`,
            );
        }
        this.secret = secret;
        this.initCrypto();
    }

    initCrypto() {
        this.crypto = crypto;
    }

    disconnectBase() {
        this.removeAllListeners();
    }

    /**
     * @param job
     * @private
     */
    protected decryptJobData(job: JobEncrypted): JobDataDecrypted {
        return {
            title: job.data.title,
            msg: this.decryptActivityStream(job.data.msg) as ActivityStream,
            sessionId: job.data.sessionId,
        };
    }

    protected decryptActivityStream(msg: string): ActivityStream {
        return this.crypto.decrypt(msg, this.secret);
    }

    protected encryptActivityStream(msg: ActivityStream): string {
        return this.crypto.encrypt(msg, this.secret);
    }
}
