import Queue from 'bull';
import crypto from '@sockethub/crypto';
import {
  JobDataDecrypted,
  JobDataEncrypted, JobDecrypted,
  JobEncrypted,
  RedisConfig
} from "./types";
import debug, {Debugger} from 'debug';
import EventEmitter from "events";

interface JobHandler {
  (job: JobDataDecrypted, done: CallableFunction)
}

export default class JobQueue extends EventEmitter {
  readonly uid: string;
  private readonly bull: Queue;
  private readonly log: Debugger;
  private readonly secret: string;
  private handler: JobHandler;
  private counter = 0;

  constructor(instanceId: string, sessionId: string, secret: string, redisConfig: RedisConfig) {
    super();
    this.bull = new Queue(instanceId + sessionId, { redis: redisConfig });
    this.uid = `sockethub:data-layer:job-queue:${instanceId}:${sessionId}`;
    this.secret = secret;
    this.log = debug(this.uid);
    this.bull.on('global:completed', async (jobId: string, result: string) => {
      const r = result ? JSON.parse(result) : "";
      const job = await this.getJob(jobId);
      this.emit('global:completed', job.data, r);
      await job.remove();
    });
    this.bull.on('global:error', async (jobId: string, result: string) => {
      this.log("unknown queue error", jobId, result);
    });
    this.bull.on('global:failed', async (jobId, result: string) => {
      const job = await this.getJob(jobId);
      this.emit('global:failed', job.data, result);
      await job.remove();
    });
  }

  add(socketId: string, msg): JobDataEncrypted {
    const job = this.createJob(socketId, msg);
    this.bull.add(job);
    return job;
  }

  async getJob(jobId: string): Promise<JobDecrypted> {
    const job = await this.bull.getJob(jobId);
    if (!job) { return job; }
    job.data.msg = this.decryptJobData(job);
    return job;
  }

  onJob(handler: JobHandler): void {
    this.handler = handler;
    this.bull.process(this.jobHandler);
  }

  async shutdown() {
    await this.bull.clean(0);
    await this.bull.obliterate({ force: true });
    await this.bull.close();
  }

  private createJob(socketId: string, msg): JobDataEncrypted {
    const title = `${msg.context}-${(msg.id) ? msg.id : this.counter++}`;
    return {
      title: title,
      sessionId: socketId,
      msg: crypto.encrypt(msg, this.secret)
    };
  }

  private jobHandler(encryptedJob: JobEncrypted, done: CallableFunction): void {
    this.log('incoming job from queue');
    const job = this.decryptJobData(encryptedJob);
    this.handler(job, done);
  }

  /**
   * @param job
   * @private
   */
  private decryptJobData(job: JobEncrypted): JobDataDecrypted {
    return {
      title: job.data.title,
      msg: crypto.decrypt(job.data.msg, this.secret),
      sessionId: job.data.sessionId
    };
  }
}