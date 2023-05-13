import Queue, { QueueOptions } from "bull";
import crypto, { Crypto } from "@sockethub/crypto";
import {
    JobDataDecrypted,
    JobDataEncrypted,
    JobDecrypted,
    JobEncrypted,
    RedisConfig,
} from "./types";
import debug, { Debugger } from "debug";
import EventEmitter from "events";
import { IActivityStream } from "@sockethub/schemas";

interface JobHandler {
    (job: JobDataDecrypted, done: CallableFunction);
}

export default class JobQueue extends EventEmitter {
    readonly uid: string;
    bull;
    crypto: Crypto;
    private readonly debug: Debugger;
    private readonly secret: string;
    private handler: JobHandler;
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
        this.initBull(instanceId + sessionId, redisConfig);
        this.initCrypto();
        this.uid = `sockethub:data-layer:job-queue:${instanceId}:${sessionId}`;
        this.secret = secret;
        this.debug = debug(this.uid);

        this.debug("initialized");
    }

    initBull(id: string, redisConfig: RedisConfig) {
        this.bull = new Queue(id, {
            redis: redisConfig,
        } as QueueOptions);
    }

    initCrypto() {
        this.crypto = crypto;
    }

    async add(
        socketId: string,
        msg: IActivityStream,
    ): Promise<JobDataEncrypted> {
        const job = this.createJob(socketId, msg);
        const isPaused = await this.bull.isPaused();
        if (isPaused) {
            this.bull.emit("failed", job, "queue closed");
            return undefined;
        }
        this.debug(`adding ${job.title} ${msg.type}`);
        this.bull.add(job);
        return job;
    }

    initResultEvents() {
        this.bull.on(
            "global:completed",
            async (jobId: string, result: string) => {
                const r = result ? JSON.parse(result) : "";
                const job = await this.getJob(jobId);
                if (job) {
                    this.debug(
                        `completed ${job.data.title} ${job.data.msg.type}`,
                    );
                    this.emit("global:completed", job.data, r);
                    job.remove();
                }
            },
        );
        this.bull.on("global:error", async (jobId: string, result: string) => {
            this.debug("unknown queue error", jobId, result);
        });
        this.bull.on("global:failed", async (jobId, result: string) => {
            const job = await this.getJob(jobId);
            if (job) {
                this.debug(`failed ${job.data.title} ${job.data.msg.type}`);
                this.emit("global:failed", job.data, result);
                job.remove();
            }
        });
        this.bull.on("failed", (job: JobDataEncrypted, result: string) => {
            // locally failed jobs (eg. due to paused queue)
            const unencryptedJobData: JobDataDecrypted = {
                title: job.title,
                msg: this.decryptActivityStream(job.msg) as IActivityStream,
                sessionId: job.sessionId,
            };
            this.debug(
                `failed ${unencryptedJobData.title} ${unencryptedJobData.msg.type}`,
            );
            this.emit("global:failed", unencryptedJobData, result);
        });
    }

    async getJob(jobId: string): Promise<JobDecrypted> {
        const job = await this.bull.getJob(jobId);
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
        this.bull.process(this.jobHandler.bind(this));
    }

    async pause() {
        await this.bull.pause();
        this.debug("paused");
    }

    async resume() {
        await this.bull.resume();
        this.debug("resumed");
    }

    async shutdown() {
        if (!(await this.bull.isPaused(true))) {
            await this.bull.pause();
        }
        await this.bull.obliterate({ force: true });
        await this.bull.removeAllListeners();
        await this.bull.close();
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

    private jobHandler(
        encryptedJob: JobEncrypted,
        done: CallableFunction,
    ): void {
        const job = this.decryptJobData(encryptedJob);
        this.debug(`handling ${job.title} ${job.msg.type}`);
        this.handler(job, done);
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
