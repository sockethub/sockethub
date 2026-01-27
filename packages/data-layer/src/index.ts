import type { Logger } from "@sockethub/schemas";

import {
    CredentialsStore,
    type CredentialsStoreInterface,
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

async function redisCheck(config: RedisConfig, log: Logger): Promise<void> {
    log.debug(`checking redis connection ${config.url}`);
    await verifySecureStore(config, log);
    await verifyJobQueue(config, log);
}

export {
    redisCheck,
    JobQueue,
    JobWorker,
    CredentialsStore,
    getRedisConnectionCount,
    resetSharedRedisConnection,
    type CredentialsStoreInterface,
};
