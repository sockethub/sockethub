import { Job, Queue, Worker } from "bullmq";
import crypto, { Crypto } from "@sockethub/crypto";
import {
    JobHandler,
    JobDataDecrypted,
    JobDataEncrypted,
    JobDecrypted,
    JobEncrypted,
    RedisConfig,
} from "./types";
import debug, { Debugger } from "debug";
import EventEmitter from "events";
import { IActivityStream } from "@sockethub/schemas";
import IORedis from "ioredis";

export function createIORedisConnection(
    config: RedisConfig,
    maxRetries = null,
) {
    return new IORedis(config.url, {
        maxRetriesPerRequest: maxRetries,
    });
}

export async function verifyJobQueue(config: RedisConfig): Promise<void> {
    const log = debug("sockethub:data-layer:job-queue");
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
            log("connection verified");
            await queue.close();
            await worker.close();
            resolve();
        });
        worker.on("error", (err) => {
            log(
                "connection verification worker error received " +
                    err.toString(),
            );
            reject(err);
        });
        const queue = new Queue("connectiontest", {
            connection: createIORedisConnection(config, 1),
        });
        queue.on("error", (err) => {
            log(
                "connection verification queue error received " +
                    err.toString(),
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

export default class JobQueue extends EventEmitter {
    readonly uid: string;
    protected crypto: Crypto;
    protected queue: Queue;
    protected worker: Worker;
    protected handler: JobHandler;
    private readonly debug: Debugger;
    private readonly secret: string;
    private readonly redisConfig: RedisConfig;
    private counter = 0;

    constructor(
        instanceId: string,
        sessionId: string,
        secret: string,
        redisConfig: RedisConfig,
    ) {
        super();
        if (secret.length !== 32) {
            throw new Error(
                "JobQueue secret must be a 32 char string, length: " +
                    secret.length,
            );
        }
        this.uid = `sockethub:data-layer:job-queue:${instanceId}:${sessionId}`;
        this.secret = secret;
        this.debug = debug(this.uid);
        this.redisConfig = redisConfig;
        this.initQueue();
        this.initCrypto();
        this.debug("initialized");
    }

    initQueue() {
        this.queue = new Queue(this.uid, {
            connection: createIORedisConnection(this.redisConfig, 1),
        });
    }

    initWorker() {
        this.worker = new Worker(this.uid, this.jobHandler.bind(this), {
            connection: createIORedisConnection(this.redisConfig),
        });
    }

    initCrypto() {
        this.crypto = crypto;
    }

    async add(
        socketId: string,
        msg: IActivityStream,
    ): Promise<JobDataEncrypted> {
        const job = this.createJob(socketId, msg);
        if (await this.queue.isPaused()) {
            // this.queue.emit("error", new Error("queue closed"));
            this.debug(
                `failed to add ${job.title} ${msg.type} to queue: queue closed`,
            );
            throw new Error("queue closed");
        }
        await this.queue.add(job.title, job);
        this.debug(`added ${job.title} ${msg.type} to queue`);
        return job;
    }

    initResultEvents() {
        //     this.events = new QueueEvents(this.uid, {
        //         connection: createIORedisConnection(this.redisConfig),
        //     });
        //     this.events.on("completed", async ({ jobId, returnvalue }) => {
        //         let jobData = returnvalue as unknown as JobDataDecrypted;
        //         if (!returnvalue) {
        //             const job = await this.getJob(jobId);
        //             jobData = job.data;
        //         }
        //         this.debug(`completed ${jobData.title} ${jobData.msg.type}`);
        //         this.emit("completed", jobData);
        //     });
        //
        //     this.events.on("failed", async (a) => {
        //         console.log("global failed fired ", a);
        //         // const job = await this.getJob(a);
        //         // if (job) {
        //         //     this.debug(`failed ${job.data.title} ${job.data.msg.type}`);
        //         //     this.emit("global:failed", job.data, result);
        //         //     job.remove();
        //         // }
        //     });
        //     // this.events.on("failed", (job: JobDataEncrypted, result: string) => {
        //     //     console.log("fail fired ", job);
        //     //     // locally failed jobs (e.g. due to paused queue)
        //     //     const unencryptedJobData: JobDataDecrypted = {
        //     //         title: job.title,
        //     //         msg: this.decryptActivityStream(job.msg) as IActivityStream,
        //     //         sessionId: job.sessionId,
        //     //     };
        //     //     this.debug(
        //     //         `failed ${unencryptedJobData.title} ${unencryptedJobData.msg.type}`,
        //     //     );
        //     //     this.emit("global:failed", unencryptedJobData, result);
        //     // });
    }

    async getJob(jobId: string): Promise<JobDecrypted> {
        const job = await this.queue.getJob(jobId);
        if (job) {
            job.data = this.decryptJobData(job);
            try {
                delete job.data.msg.sessionSecret;
            } catch (e) {
                // this property should never be exposed externally
            }
        }
        return job;
    }

    onJob(handler: JobHandler): void {
        this.handler = handler;
        this.initWorker();

        this.on("completed", (jobData) => {
            this.debug(`completed ${jobData.title} ${jobData.msg.type}`);
        });

        this.on("error", (err) => {
            this.debug("worker error", err);
        });

        this.on("global:failed", (jobData) => {
            this.debug(`failed ${jobData.title} ${jobData.msg.type}`);
        });

        this.worker.on("completed", async (job) => {
            const jobData: JobDataDecrypted = this.decryptJobData(job);
            this.emit("completed", jobData);
            await job.remove();
        });

        // Temporarily disabled due to strange eslint crash:
        //   TypeError: Cannot read properties of undefined (reading 'name')
        // this.worker.on("error", (err) => {
        //     // eslint-disable-next-line security-node/detect-unhandled-event-errors
        //     this.emit("error", err);
        // });

        this.worker.on("failed", async (job) => {
            const jobData: JobDataDecrypted = job.data;
            this.emit("global:failed", jobData);
            await job.remove();
        });
    }

    async pause() {
        await this.queue.pause();
        this.debug("paused");
    }

    async resume() {
        await this.queue.resume();
        this.debug("resumed");
    }

    async shutdown() {
        if (this.queue) {
            if (!(await this.queue.isPaused())) {
                await this.queue.pause();
            }
            await this.queue.obliterate({ force: true });
            this.queue.removeAllListeners();
            await this.queue.close();
            await this.queue.disconnect();
        }

        if (this.worker) {
            await this.worker.pause();
            this.worker.removeAllListeners();
            await this.worker.close();
            await this.worker.disconnect();
        }
    }

    private createJob(
        socketId: string,
        msg: IActivityStream,
    ): JobDataEncrypted {
        const title = `${msg.context}-${msg.id ? msg.id : this.counter++}`;
        return {
            title: title,
            sessionId: socketId,
            msg: this.crypto.encrypt(msg, this.secret),
        };
    }

    protected async jobHandler(encryptedJob: JobEncrypted) {
        const job = this.decryptJobData(encryptedJob);
        this.debug(`handling ${job.title} ${job.msg.type}`);
        return this.handler(job);
    }

    /**
     * @param job
     * @private
     */
    private decryptJobData(job: JobEncrypted): JobDataDecrypted {
        return {
            title: job.data.title,
            msg: this.decryptActivityStream(job.data.msg) as IActivityStream,
            sessionId: job.data.sessionId,
        };
    }

    private decryptActivityStream(msg: string): IActivityStream {
        return this.crypto.decrypt(msg, this.secret);
    }
}
