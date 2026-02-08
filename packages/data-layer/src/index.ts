import { createLogger } from "@sockethub/logger";

import {
    CredentialsStore,
    type CredentialsStoreInterface,
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

async function redisCheck(config: RedisConfig): Promise<void> {
    const log = createLogger("data-layer:redis-check");
    log.debug(`checking redis connection ${config.url}`);
    await verifySecureStore(config);
    await verifyJobQueue(config);
}

export {
    redisCheck,
    JobQueue,
    JobWorker,
    CredentialsStore,
    getRedisConnectionCount,
    resetSharedRedisConnection,
    resetSharedCredentialsRedisConnection,
    type CredentialsStoreInterface,
};
