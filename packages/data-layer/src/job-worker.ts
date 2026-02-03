import {
    type Logger,
    createLogger,
    getLoggerNamespace,
} from "@sockethub/logger";
import { Worker } from "bullmq";

import { JobBase } from "./job-base.js";
import { buildQueueId } from "./queue-id.js";
import type { JobEncrypted, JobHandler, RedisConfig } from "./types.js";

/**
 * Worker for processing jobs from a Redis queue within platform child processes.
 *
 * Connects to the same queue as its corresponding JobQueue instance and processes
 * jobs using a platform-specific handler function. Provides automatic decryption
 * of job data and error handling.
 *
 * @example
 * ```typescript
 * const worker = new JobWorker('irc-platform', 'session123', secret, redisConfig);
 * worker.onJob(async (job) => {
 *   // Process the decrypted ActivityStreams message
 *   return await processMessage(job.msg);
 * });
 * ```
 */
export class JobWorker extends JobBase {
    private readonly connectionName: string;
    protected worker: Worker;
    protected handler: JobHandler;
    private readonly log: Logger;
    private readonly redisConfig: RedisConfig;
    protected readonly queueId: string;
    private initialized = false;

    /**
     * Creates a new JobWorker instance.
     *
     * @param parentId - Must match the parentId of the corresponding JobQueue
     * @param instanceId - Must match the instanceId of the corresponding JobQueue
     * @param secret - 32-character encryption secret, must match JobQueue secret
     * @param redisConfig - Redis connection configuration
     */
    constructor(
        parentId: string,
        instanceId: string,
        secret: string,
        redisConfig: RedisConfig,
    ) {
        super(secret);
        // Create logger with full namespace (context will be prepended automatically)
        this.log = createLogger(`data-layer:worker:${parentId}:${instanceId}`);

        // Use logger's full namespace (includes context) for Redis connection name
        this.connectionName = getLoggerNamespace(this.log);
        redisConfig.connectionName = this.connectionName;

        // Queue ID must match JobQueue's namespace (context-free) for cross-process connection
        this.queueId = buildQueueId(parentId, instanceId);
        this.redisConfig = redisConfig;
    }

    protected init() {
        if (this.initialized) {
            throw new Error(
                `JobWorker already initialized for ${this.queueId}`,
            );
        }
        this.initialized = true;
        // BullMQ v5+ prohibits colons in queue names; derive the queue name
        // from the canonical queue id by replacing ':' with '-'.
        const queueName = this.queueId.replace(/:/g, "-");
        // Let BullMQ create its own connection (it duplicates them internally anyway)
        this.worker = new Worker(queueName, this.jobHandler.bind(this), {
            connection: this.redisConfig,
            // Prevent infinite retry loops when platform child process crashes mid-job.
            // If worker disappears (crash/disconnect), job becomes "stalled" and retries
            // up to maxStalledCount times (with default 30s interval) before failing permanently.
            maxStalledCount: 3,
        });

        // Handle Redis contention errors (e.g., BUSY from Lua scripts)
        this.worker.on("error", (err) => {
            this.log.warn(`worker error: ${err.message}`);
        });

        this.log.info("initialized");
    }

    /**
     * Registers a job handler function and starts processing jobs from the queue.
     *
     * @param handler - Function that processes decrypted job data and returns results
     */
    onJob(handler: JobHandler): void {
        this.handler = handler;
        this.init();
    }

    /**
     * Gracefully shuts down the worker, stopping job processing and cleaning up connections.
     */
    async shutdown() {
        await this.worker.pause();
        this.removeAllListeners();
        this.worker.removeAllListeners();
        await this.worker.close();
    }

    protected async jobHandler(encryptedJob: JobEncrypted) {
        const job = this.decryptJobData(encryptedJob);
        this.log.debug(`handling ${job.title} ${job.msg.type}`);
        return await this.handler(job);
    }
}
