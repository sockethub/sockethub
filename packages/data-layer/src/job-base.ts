import crypto, { Crypto } from "@sockethub/crypto";
import { JobDataDecrypted, JobEncrypted, RedisConfig } from "./types";
import EventEmitter from "events";
import { IActivityStream } from "@sockethub/schemas";
import IORedis from "ioredis";

export function createIORedisConnection(config: RedisConfig) {
    return new IORedis(config.url, {
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

    /**
     * @param job
     * @private
     */
    protected decryptJobData(job: JobEncrypted): JobDataDecrypted {
        return {
            title: job.data.title,
            msg: this.decryptActivityStream(job.data.msg) as IActivityStream,
            sessionId: job.data.sessionId,
        };
    }

    protected decryptActivityStream(msg: string): IActivityStream {
        return this.crypto.decrypt(msg, this.secret);
    }

    protected encryptActivityStream(msg: IActivityStream): string {
        return this.crypto.encrypt(msg, this.secret);
    }
}
