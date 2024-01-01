import { Job, Queue, Worker, QueueEvents } from "bullmq";
import { JobDataEncrypted, JobDecrypted, RedisConfig } from "./types";
import debug, { Debugger } from "debug";
import { ActivityStream } from "@sockethub/schemas";
import JobBase, { createIORedisConnection } from "./job-base";

export async function verifyJobQueue(config: RedisConfig): Promise<void> {
    const log = debug("sockethub:data-layer:queue");
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
            connection: createIORedisConnection(config),
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

export default class JobQueue extends JobBase {
    readonly uid: string;
    protected queue: Queue;
    protected events: QueueEvents;
    private readonly debug: Debugger;
    private counter = 0;
    private initialized = false;
    protected redisConnection;

    constructor(
        instanceId: string,
        sessionId: string,
        secret: string,
        redisConfig: RedisConfig,
    ) {
        super(secret);
        this.uid = `sockethub:data-layer:queue:${instanceId}:${sessionId}`;
        this.debug = debug(this.uid);
        this.init(redisConfig);
    }

    protected init(redisConfig: RedisConfig) {
        if (this.initialized) {
            throw new Error(`JobQueue already initialized for ${this.uid}`);
        }
        this.initialized = true;

        this.redisConnection = createIORedisConnection(redisConfig);
        this.queue = new Queue(this.uid, {
            connection: this.redisConnection,
        });
        this.events = new QueueEvents(this.uid, {
            connection: this.redisConnection,
        });

        this.events.on("completed", async ({ jobId, returnvalue }) => {
            const job = await this.getJob(jobId);
            this.debug(`completed ${job.data.title} ${job.data.msg.type}`);
            this.emit("completed", job.data, returnvalue);
        });

        this.events.on("failed", async ({ jobId, failedReason }) => {
            const job = await this.getJob(jobId);
            this.debug(
                `failed ${job.data.title} ${job.data.msg.type}: ${failedReason}`,
            );
            this.emit("failed", job.data, failedReason);
        });
        this.debug(`initialized`);
    }

    async add(
        socketId: string,
        msg: ActivityStream,
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

    async pause() {
        await this.queue.pause();
        this.debug("paused");
    }

    async resume() {
        await this.queue.resume();
        this.debug("resumed");
    }

    async shutdown() {
        this.removeAllListeners();
        this.queue.removeAllListeners();
        if (!(await this.queue.isPaused())) {
            await this.queue.pause();
        }
        await this.queue.obliterate({ force: true });
        await this.queue.close();
        await this.queue.disconnect();
        await this.events.close();
        await this.events.disconnect();
        await this.redisConnection.disconnect();
    }

    private async getJob(jobId: string): Promise<JobDecrypted> {
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

    private createJob(socketId: string, msg: ActivityStream): JobDataEncrypted {
        const title = `${msg.context}-${msg.id ? msg.id : this.counter++}`;
        return {
            title: title,
            sessionId: socketId,
            msg: this.encryptActivityStream(msg),
        };
    }
}
