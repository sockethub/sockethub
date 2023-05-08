/* eslint-disable  @typescript-eslint/no-explicit-any */
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import {IActivityStream} from "@sockethub/schemas";
import hash from 'object-hash';

const ALGORITHM = 'aes-256-cbc',
      IV_LENGTH = 16; // For AES, this is always 16

export function getPlatformId(platform: string, actor?: string): string {
  return actor ? crypto.hash(platform + actor) : crypto.hash(platform);
}

class Crypto {

  encrypt(json: IActivityStream, secret: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, Buffer.from(secret), iv);
    let encrypted = cipher.update(JSON.stringify(json));

    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  decrypt(text: string, secret: string): IActivityStream {
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = Buffer.from(parts.join(':'), 'hex');
    const decipher = createDecipheriv(ALGORITHM, Buffer.from(secret), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
  }

  hash(text: string): string {
    const SHASum = createHash('sha1');
    SHASum.update(text);
    return SHASum.digest('hex').substring(0, 7);
  }

  objectHash(object: any): string {
    return hash(object);
  }

  randToken(len: number): string {
    if (len > 32) {
      throw new Error(`crypto.randToken supports a length param of up to 32, ${len} given`);
    }
    const buf = randomBytes(len);
    return buf.toString('hex').substring(0, len);
  }
}

const crypto = new Crypto();
export default crypto;
