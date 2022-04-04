import crypto from "./crypto";
import { JobDataDecrypted, JobEncrypted } from "./sockethub";

export function getPlatformId(platform: string, actor?: string): string {
  return actor ? crypto.hash(platform + actor) : crypto.hash(platform);
}

export function decryptJobData(job: JobEncrypted, secret: string): JobDataDecrypted {
  return {
    title: job.data.title,
    msg: crypto.decrypt(job.data.msg, secret),
    sessionId: job.data.sessionId
  };
}