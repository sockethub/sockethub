import { createLogger } from "@sockethub/logger";

import {
    CredentialsMismatchError,
    CredentialsNotShareableError,
    CredentialsStore,
    type CredentialsStoreInterface,
    type CredentialsValidationOptions,
    resetSharedCredentialsRedisConnection,
    verifySecureStore,
} from "./credentials-store.js";
import {
    getRedisConnectionCount,
    resetSharedRedisConnection,
} from "./job-base.js";
import { JobQueue, verifyJobQueue } from "./job-queue.js";
import { JobWorker } from "./job-worker.js";

export * from "./types.js";

import type { RedisConfig } from "./types.js";

function sanitizeRedisUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) {
            parsed.username = parsed.username ? "***" : parsed.username;
            parsed.password = parsed.password ? "***" : parsed.password;
        }
        return parsed.toString();
    } catch {
        return url;
    }
}

async function redisCheck(config: RedisConfig): Promise<void> {
    const log = createLogger("data-layer:redis-check");
    log.debug(`checking redis connection ${sanitizeRedisUrl(config.url)}`);
    await verifySecureStore(config);
    await verifyJobQueue(config);
}

export {
    redisCheck,
    JobQueue,
    JobWorker,
    CredentialsStore,
    CredentialsMismatchError,
    CredentialsNotShareableError,
    getRedisConnectionCount,
    resetSharedRedisConnection,
    resetSharedCredentialsRedisConnection,
    type CredentialsValidationOptions,
    type CredentialsStoreInterface,
};
