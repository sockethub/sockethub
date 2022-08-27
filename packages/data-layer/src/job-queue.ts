import Queue from 'bull';
import crypto from '@sockethub/crypto';
import {
  JobDataDecrypted,
  JobDataEncrypted, JobDecrypted,
  JobEncrypted,
  RedisConfig
} from "./types";
import debug, {Debugger} from 'debug';

interface JobHandler {
  (job: JobDataDecrypted, done: CallableFunction)
}

export default class JobQueue {
  readonly uid: string;
  private readonly bull: Queue;
  private readonly log: Debugger;
  private readonly secret: string;
  private handler: JobHandler;
  private counter = 0;

  constructor(instanceId: string, sessionId: string, secret: string, redisConfig: RedisConfig) {
    this.uid = `sockethub:data-layer:job-queue:${instanceId}:${sessionId}`;
    this.secret = secret;
    this.bull = new Queue(instanceId + sessionId, { redis: redisConfig });
    this.log = debug(this.uid);
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