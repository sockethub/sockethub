import debug from "debug";

import {
    CredentialsStore,
    type CredentialsStoreInterface,
    verifySecureStore,
} from "./credentials-store.js";
import { JobQueue, verifyJobQueue } from "./job-queue.js";
import { JobWorker } from "./job-worker.js";

export * from "./types.js";

import type { RedisConfig } from "./types.js";

const log = debug("sockethub:data-layer");

async function redisCheck(config: RedisConfig): Promise<void> {
    log(`checking redis connection ${config.url}`);
    await verifySecureStore(config);
    await verifyJobQueue(config);
}

export {
    redisCheck,
    JobQueue,
    JobWorker,
    CredentialsStore,
    type CredentialsStoreInterface,
};
