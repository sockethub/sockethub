import { type Logger, createLogger, getLoggerContext } from "@sockethub/logger";
import { Worker } from "bullmq";

import { JobBase, createIORedisConnection } from "./job-base.js";
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
    readonly uid: string;
    protected worker: Worker;
    protected handler: JobHandler;
    private readonly log: Logger;
    private readonly redisConfig: RedisConfig;
    private readonly queueId: string;
    private initialized = false;

    /**
     * Creates a new JobWorker instance.
     *
     * @param instanceId - Must match the instanceId of the corresponding JobQueue
     * @param sessionId - Must match the sessionId of the corresponding JobQueue
     * @param secret - 32-character encryption secret, must match JobQueue secret
     * @param redisConfig - Redis connection configuration
     */
    constructor(
        instanceId: string,
        sessionId: string,
        secret: string,
        redisConfig: RedisConfig,
    ) {
        super(secret);
        // Use short namespace for logging (context provides process identification)
        const logNamespace = "data-layer:worker";
        this.log = createLogger(logNamespace);

        // Queue IDs are derived from namespace + identifiers for matching across processes
        this.uid = `${logNamespace}:${instanceId}:${sessionId}`;
        this.queueId = `data-layer:queue:${instanceId}:${sessionId}`;
        this.redisConfig = redisConfig;
    }

    protected init() {
        if (this.initialized) {
            throw new Error(`JobWorker already initialized for ${this.uid}`);
        }
        this.initialized = true;
        // BullMQ v5+ prohibits colons in queue names, so replace with dashes
        // while keeping queueId with colons for debug namespace convention
        const queueName = this.queueId.replace(/:/g, "-");
        // Let BullMQ create its own connection for better lifecycle management
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
