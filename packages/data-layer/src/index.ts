import { createLogger } from "@sockethub/logger";

import {
    CredentialsMismatchError,
    CredentialsNotShareableError,
    CredentialsStore,
    type CredentialsStoreInterface,
    type CredentialsValidationOptions,
    createCredentialsRedisConnection,
    createIdempotencyRedisConnection,
    createRateLimitRedisConnection,
    resetSharedCredentialsRedisConnection,
    resetSharedIdempotencyRedisConnection,
    resetSharedRateLimitRedisConnection,
    verifySecureStore,
} from "./credentials-store.js";
import {
    getRedisConnectionCount,
    resetSharedRedisConnection,
} from "./job-base.js";
import { JobQueue, verifyJobQueue } from "./job-queue.js";
import { JobWorker, type JobWorkerOptions } from "./job-worker.js";

export * from "./types.js";

import type { RedisConfig } from "./types.js";

function sanitizeRedisUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.username) {
            parsed.username = "***";
        }
        if (parsed.password) {
            parsed.password = "***";
        }
        return parsed.toString();
    } catch {
        // Parse failure: do not leak the original URL, which may contain credentials.
        return "<redis-url:unparseable>";
    }
}

async function redisCheck(config: RedisConfig): Promise<void> {
    const log = createLogger("data-layer:redis-check");
    log.debug(`checking redis connection ${sanitizeRedisUrl(config.url)}`);
    await verifySecureStore(config);
    await verifyJobQueue(config);
}

export {
    CredentialsMismatchError,
    CredentialsNotShareableError,
    CredentialsStore,
    type CredentialsStoreInterface,
    type CredentialsValidationOptions,
    createCredentialsRedisConnection,
    createIdempotencyRedisConnection,
    createRateLimitRedisConnection,
    getRedisConnectionCount,
    JobQueue,
    JobWorker,
    type JobWorkerOptions,
    redisCheck,
    resetSharedCredentialsRedisConnection,
    resetSharedIdempotencyRedisConnection,
    resetSharedRateLimitRedisConnection,
    resetSharedRedisConnection,
};
