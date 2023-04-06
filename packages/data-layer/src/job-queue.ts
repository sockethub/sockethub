import Queue, { QueueOptions } from "bull";
import crypto from "@sockethub/crypto";
import {
  JobDataDecrypted,
  JobDataEncrypted,
  JobDecrypted,
  JobEncrypted,
  RedisConfig
} from "./types";
import debug, { Debugger } from "debug";
import EventEmitter from "events";
import { IActivityStream, JobActivityStream } from "@sockethub/schemas";

interface JobHandler {
  (job: JobDataDecrypted, done: CallableFunction): void;
}

export default class JobQueue extends EventEmitter {
  readonly uid: string;
  private readonly bull;
  private readonly debug: Debugger;
  private readonly secret: string;
  private handler: JobHandler;
  private counter = 0;

  constructor(
    instanceId: string,
    sessionId: string,
    secret: string,
    redisConfig: RedisConfig
  ) {
    super();
    this.bull = new Queue(instanceId + sessionId, {
      redis: redisConfig,
    } as QueueOptions);
    this.uid = `sockethub:data-layer:job-queue:${instanceId}:${sessionId}`;
    this.secret = secret;
    this.debug = debug(this.uid);

    this.debug("initialized");
  }

  async add(socketId: string, msg: JobActivityStream): Promise<JobDataEncrypted|undefined> {
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
    this.bull.on("global:completed", async (jobId: string, result: never) => {
      const r = result ? JSON.parse(result) : "";
      const job = await this.getJob(jobId);
      if (job) {
        this.debug(`completed ${job.data.title} ${job.data.msg.type}`);
        this.emit("global:completed", job.data, r);
        await job.remove();
      }
    });
    this.bull.on("global:error", async (jobId: string, result: string) => {
      this.debug("unknown queue error", jobId, result);
    });
    this.bull.on("global:failed", async (jobId, result: string) => {
      const job = await this.getJob(jobId);
      if (job) {
        this.debug(`failed ${job.data.title} ${job.data.msg.type}`);
        this.emit("global:failed", job.data, result);
        await job.remove();
      }
    });
    this.bull.on("failed", (job: JobDataEncrypted, result: string) => {
      // locally failed jobs (eg. due to paused queue)
      const unencryptedJobData: JobDataDecrypted = {
        title: job.title,
        msg: this.decryptActivityStream(job.msg),
        sessionId: job.sessionId,
      };
      this.debug(
        `failed ${unencryptedJobData.title} ${unencryptedJobData.msg.type}`
      );
      this.emit("global:failed", unencryptedJobData, result);
    });
  }

  async getJob(jobId: string): Promise<JobDecrypted|undefined> {
    const job = await this.bull.getJob(jobId);
    if (job) {
      job.data = this.decryptJobData(job);
      try {
        delete job.data.msg.sessionSecret;
      } catch (e) {
        // this property should never be exposed externally
      }
      return job;
    } else {
      return undefined;
    }
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
    const isPaused = await this.bull.isPaused(true);
    if (!isPaused) {
      await this.bull.pause();
    }
    await this.bull.obliterate({ force: true });
    await this.bull.removeAllListeners();
  }

  private createJob(socketId: string, msg: JobActivityStream): JobDataEncrypted {
    const title = `${msg.context}-${msg.id ? msg.id : this.counter++}`;
    return {
      title: title,
      sessionId: socketId,
      msg: crypto.encrypt(msg, this.secret),
    };
  }

  private jobHandler(encryptedJob: JobEncrypted, done: CallableFunction): void {
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
      msg: this.decryptActivityStream(job.data.msg),
      sessionId: job.data.sessionId,
    };
  }

  private decryptActivityStream(msg: string): IActivityStream {
    return crypto.decrypt(msg, this.secret);
  }
}
