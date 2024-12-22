import crypto, { Crypto } from "@sockethub/crypto";
import { JobDataDecrypted, JobEncrypted, RedisConfig } from "./types";
import EventEmitter from "events";
import { ActivityStream } from "@sockethub/schemas";
import IORedis, { Redis } from "ioredis";

export function createIORedisConnection(config: RedisConfig): Redis {
  return new IORedis(config.url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
  });
}

export default class JobBase extends EventEmitter {
  protected crypto: Crypto;
  private readonly secret: string;

  constructor(secret: string) {
    super();
    if (secret.length !== 32) {
      throw new Error(
        "secret must be a 32 char string, length: " + secret.length,
      );
    }
    this.secret = secret;
    this.initCrypto();
  }

  initCrypto() {
    this.crypto = crypto;
  }

  disconnectBase() {
    this.removeAllListeners();
  }

  /**
   * @param job
   * @private
   */
  protected decryptJobData(job: JobEncrypted): JobDataDecrypted {
    return {
      title: job.data.title,
      msg: this.decryptActivityStream(job.data.msg) as ActivityStream,
      sessionId: job.data.sessionId,
    };
  }

  protected decryptActivityStream(msg: string): ActivityStream {
    return this.crypto.decrypt(msg, this.secret);
  }

  protected encryptActivityStream(msg: ActivityStream): string {
    return this.crypto.encrypt(msg, this.secret);
  }
}
