import EventEmitter from "node:events";
import IORedis, { type Redis } from "ioredis";

import { crypto, type Crypto } from "@sockethub/crypto";
import type { ActivityStream } from "@sockethub/schemas";

import type { JobDataDecrypted, JobEncrypted, RedisConfig } from "./types.js";

export function createIORedisConnection(config: RedisConfig): Redis {
    return new IORedis(config.url, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: null,
    });
}

export class JobBase extends EventEmitter {
    protected crypto: Crypto;
    private readonly secret: string;

    constructor(secret: string) {
        super();
        if (secret.length !== 32) {
            throw new Error(
                `secret must be a 32 char string, length: ${secret.length}`,
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
