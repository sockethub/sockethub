import { Worker } from "bullmq";
import {
    JobHandler,
    JobEncrypted,
    RedisConfig,
} from "./types";
import debug, { Debugger } from "debug";
import JobBase, { createIORedisConnection } from "./job-base";

export default class JobWorker extends JobBase {
    readonly uid: string;
    protected worker: Worker;
    protected handler: JobHandler;
    private readonly debug: Debugger;
    private readonly redisConfig: RedisConfig;
    private readonly queueId: string;
    private initialized = false;

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
        this.debug("initialized");
    }

    init() {
        if (this.initialized) { throw new Error(`JobWorker already initialized for ${this.uid}`)}
        this.initialized = true;
        this.worker = new Worker(this.queueId, this.jobHandler.bind(this), {
            connection: createIORedisConnection(this.redisConfig),
        });
    }

    onJob(handler: JobHandler): void {
        this.handler = handler;
        this.init();
    }

    async shutdown() {
        await this.worker.pause();
        this.worker.removeAllListeners();
        await this.worker.close();
        await this.worker.disconnect();
    }

    protected async jobHandler(encryptedJob: JobEncrypted) {
        const job = this.decryptJobData(encryptedJob);
        this.debug(`handling ${job.title} ${job.msg.type}`);
        const ret = await this.handler(job);
        return ret;
    }
}
