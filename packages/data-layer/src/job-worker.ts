import { Worker } from "bullmq";
import debug, { type Debugger } from "debug";

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
    protected redisConnection;
    private readonly debug: Debugger;
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
        this.uid = `sockethub:data-layer:worker:${instanceId}:${sessionId}`;
        this.queueId = `sockethub:data-layer:queue:${instanceId}:${sessionId}`;
        this.debug = debug(this.uid);
        this.redisConfig = redisConfig;
    }

    protected init() {
        if (this.initialized) {
            throw new Error(`JobWorker already initialized for ${this.uid}`);
        }
        this.initialized = true;
        this.redisConnection = createIORedisConnection(this.redisConfig);
        this.worker = new Worker(this.queueId, this.jobHandler.bind(this), {
            connection: this.redisConnection,
        });
        this.debug("initialized");
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
        await this.worker.disconnect();
        await this.redisConnection.disconnect();
    }

    protected async jobHandler(encryptedJob: JobEncrypted) {
        const job = this.decryptJobData(encryptedJob);
        this.debug(`handling ${job.title} ${job.msg.type}`);
        return await this.handler(job);
    }
}
