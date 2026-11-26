import { createLogger } from "@sockethub/logger";

import {
    CredentialsMismatchError,
    CredentialsStore,
    type CredentialsStoreInterface,
    type CredentialsStoreOptions,
    type CredentialsValidationOptions,
    createCredentialsRedisConnection,
    createIdempotencyRedisConnection,
    createRateLimitRedisConnection,
    purgeCredentialsStoreKeys,
    purgeCredentialsStores,
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
import {
    buildAliveKey,
    KNOWN_SERVERS_KEY,
    startAliveHeartbeat,
    sweepOrphanedQueues,
} from "./orphan-sweep.js";
import { buildCredentialsKey } from "./queue-id.js";
import {
    createScheduleRedisConnection,
    type LoadedSchedule,
    nextAttempt,
    SCHEDULE_DUE_KEY,
    type ScheduledMessage,
    type ScheduleLoad,
    type ScheduleRecord,
    ScheduleStore,
    scheduleRecordKey,
} from "./schedule-store.js";

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
    buildAliveKey,
    buildCredentialsKey,
    CredentialsMismatchError,
    CredentialsStore,
    type CredentialsStoreInterface,
    type CredentialsStoreOptions,
    type CredentialsValidationOptions,
    createCredentialsRedisConnection,
    createIdempotencyRedisConnection,
    createRateLimitRedisConnection,
    createScheduleRedisConnection,
    getRedisConnectionCount,
    JobQueue,
    KNOWN_SERVERS_KEY,
    purgeCredentialsStoreKeys,
    purgeCredentialsStores,
    JobWorker,
    type JobWorkerOptions,
    type LoadedSchedule,
    type ScheduleLoad,
    nextAttempt,
    redisCheck,
    resetSharedCredentialsRedisConnection,
    resetSharedIdempotencyRedisConnection,
    resetSharedRateLimitRedisConnection,
    resetSharedRedisConnection,
    SCHEDULE_DUE_KEY,
    type ScheduledMessage,
    type ScheduleRecord,
    ScheduleStore,
    scheduleRecordKey,
    startAliveHeartbeat,
    sweepOrphanedQueues,
};
