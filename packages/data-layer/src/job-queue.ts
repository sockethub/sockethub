import { type Logger, createLogger, getLoggerContext } from "@sockethub/logger";
import type { ActivityStream } from "@sockethub/schemas";
import { type Job, Queue, QueueEvents, Worker } from "bullmq";

import { JobBase, createIORedisConnection } from "./job-base.js";
import type { JobDataEncrypted, JobDecrypted, RedisConfig } from "./types.js";

export async function verifyJobQueue(config: RedisConfig): Promise<void> {
    const log = createLogger("data-layer:verify-job-queue");

    return new Promise((resolve, reject) => {
        const worker = new Worker(
            "connectiontest",
            async (job) => {
                if (job.name !== "foo" || job.data?.foo !== "bar") {
                    reject(
                        "Worker received invalid job data during JobQueue connection test",
                    );
                }
                job.data.test = "touched by worker";
            },
            {
                connection: createIORedisConnection(config),
            },
        );
        worker.on("completed", async (job: Job) => {
            if (job.name !== "foo" || job.data?.test !== "touched by worker") {
                reject(
                    "Worker job completed unsuccessfully during JobQueue connection test",
                );
            }
            log.info("job queue connection verified");
            await queue.close();
            await worker.close();
            resolve();
        });
        worker.on("error", (err) => {
            log.warn(
                `connection verification worker error received ${err.toString()}`,
            );
            reject(err);
        });
        const queue = new Queue("connectiontest", {
            connection: createIORedisConnection(config),
        });
        queue.on("error", (err) => {
            log.warn(
                `connection verification queue error received ${err.toString()}`,
            );
            reject(err);
        });
        queue.add(
            "foo",
            { foo: "bar" },
            { removeOnComplete: true, removeOnFail: true },
        );
    });
}

/**
 * Redis-backed job queue for managing ActivityStreams message processing.
 *
 * Creates isolated queues per platform instance and session, providing reliable
 * message delivery and processing coordination between Sockethub server and
 * platform workers.
 *
 * @example
 * ```typescript
 * const queue = new JobQueue('irc-platform', 'session123', secret, redisConfig);
 * await queue.add('socket-id', activityStreamMessage);
 * ```
 */
export class JobQueue extends JobBase {
    readonly uid: string;
    protected queue: Queue;
    protected events: QueueEvents;
    private readonly log: Logger;
    private counter = 0;
    private initialized = false;

    /**
     * Creates a new JobQueue instance.
     *
     * @param instanceId - Unique identifier for the platform instance
     * @param sessionId - Client session identifier for queue isolation
     * @param secret - 32-character encryption secret for message security
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
        const logNamespace = "data-layer:queue";
        this.log = createLogger(logNamespace);

        // Queue ID is derived from namespace + identifiers for matching across processes
        this.uid = `${logNamespace}:${instanceId}:${sessionId}`;
        this.init(redisConfig);
    }

    protected init(redisConfig: RedisConfig) {
        if (this.initialized) {
            throw new Error(`JobQueue already initialized for ${this.uid}`);
        }
        this.initialized = true;

        // BullMQ v5+ prohibits colons in queue names, so replace with dashes
        // while keeping uid with colons for debug namespace convention
        const queueName = this.uid.replace(/:/g, "-");
        // Let BullMQ create its own connections for better lifecycle management
        this.queue = new Queue(queueName, {
            connection: redisConfig,
        });
        this.events = new QueueEvents(queueName, {
            connection: redisConfig,
        });

        // Handle Redis contention errors (e.g., BUSY from Lua scripts)
        this.queue.on("error", (err) => {
            this.log.warn(`queue error: ${err.message}`);
        });

        this.events.on("error", (err) => {
            this.log.warn(`events error: ${err.message}`);
        });

        this.events.on("completed", async ({ jobId, returnvalue }) => {
            const job = await this.getJob(jobId);
            if (!job) {
                this.log.debug(`completed job ${jobId} (already removed)`);
                return;
            }
            this.log.debug(`completed ${job.data.title} ${job.data.msg.type}`);
            this.emit("completed", job.data, returnvalue);
        });

        this.events.on("failed", async ({ jobId, failedReason }) => {
            const job = await this.getJob(jobId);
            if (!job) {
                this.log.debug(
                    `failed job ${jobId} (already removed): ${failedReason}`,
                );
                return;
            }
            this.log.warn(
                `failed ${job.data.title} ${job.data.msg.type}: ${failedReason}`,
            );
            this.emit("failed", job.data, failedReason);
        });
        this.log.info("initialized");
    }

    /**
     * Adds an ActivityStreams message to the job queue for processing.
     *
     * @param socketId - Socket.IO connection identifier for response routing
     * @param msg - ActivityStreams message to be processed by platform worker
     * @returns Promise resolving to encrypted job data
     * @throws Error if queue is closed or Redis connection fails
     */
    async add(
        socketId: string,
        msg: ActivityStream,
    ): Promise<JobDataEncrypted> {
        const job = this.createJob(socketId, msg);
        if (await this.queue.isPaused()) {
            // this.queue.emit("error", new Error("queue closed"));
            this.log.debug(
                `failed to add ${job.title} ${msg.type} to queue: queue closed`,
            );
            throw new Error("queue closed");
        }
        await this.queue.add(job.title, job, {
            // Auto-remove jobs after 5 minutes to prevent Redis memory buildup.
            // Jobs only need to exist long enough for event handlers to look them up
            // by jobId and send results to clients (typically < 1 second).
            removeOnComplete: { age: 300 }, // 5 minutes in seconds
            removeOnFail: { age: 300 },
        });
        this.log.debug(`added ${job.title} ${msg.type} to queue`);
        return job;
    }

    /**
     * Pauses job processing. New jobs can still be added but won't be processed.
     */
    async pause() {
        await this.queue.pause();
        this.log.debug("paused");
    }

    /**
     * Resumes job processing after being paused.
     */
    async resume() {
        await this.queue.resume();
        this.log.debug("resumed");
    }

    /**
     * Gracefully shuts down the queue, cleaning up all resources and connections.
     */
    async shutdown() {
        this.removeAllListeners();
        this.queue.removeAllListeners();
        if (!(await this.queue.isPaused())) {
            await this.queue.pause();
        }
        await this.queue.obliterate({ force: true });
        await this.queue.close();
        await this.events.close();
    }

    private async getJob(jobId: string): Promise<JobDecrypted> {
        const job = await this.queue.getJob(jobId);
        if (job) {
            job.data = this.decryptJobData(job);
            try {
                // biome-ignore lint/performance/noDelete: <explanation>
                delete job.data.msg.sessionSecret;
            } catch (e) {
                // this property should never be exposed externally
            }
        }
        return job;
    }

    private createJob(socketId: string, msg: ActivityStream): JobDataEncrypted {
        const title = `${msg.context}-${msg.id ? msg.id : this.counter++}`;
        return {
            title: title,
            sessionId: socketId,
            msg: this.encryptActivityStream(msg),
        };
    }
}
