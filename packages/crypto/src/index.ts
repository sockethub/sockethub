import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";
import type { ActivityStream } from "@sockethub/schemas";
import hash from "object-hash";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // For AES, this is always 16

export function getPlatformId(
    platform: string,
    actor?: string,
    _crypto = crypto,
): string {
    return actor ? _crypto.hash(platform + actor) : _crypto.hash(platform);
}

export class Crypto {
    randomBytes: typeof randomBytes;

    constructor() {
        this.createRandomBytes();
    }

    createRandomBytes() {
        this.randomBytes = randomBytes;
    }

    encrypt(json: ActivityStream, secret: string): string {
        Crypto.ensureSecret(secret);
        const iv = this.randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, Buffer.from(secret), iv);
        let encrypted = cipher.update(JSON.stringify(json));

        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
    }

    decrypt(text: string, secret: string): ActivityStream {
        Crypto.ensureSecret(secret);
        const parts = text.split(":");
        const iv = Buffer.from(parts.shift(), "hex");
        const encryptedText = Buffer.from(parts.join(":"), "hex");
        const decipher = createDecipheriv(ALGORITHM, Buffer.from(secret), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return JSON.parse(decrypted.toString());
    }

    hash(text: string): string {
        const SHASum = createHash("sha1");
        SHASum.update(text);
        return SHASum.digest("hex").substring(0, 7);
    }

    objectHash(object: never): string {
        return hash(object);
    }

    randToken(len: number): string {
        if (len > 32) {
            throw new Error(
                `crypto.randToken supports a length param of up to 32, ${len} given`,
            );
        }
        const buf = this.randomBytes(len);
        return buf.toString("hex").substring(0, len);
    }

    private static ensureSecret(secret: string) {
        if (secret.length !== 32) {
            throw new Error(
                `secret must be a 32 char string, length: ${secret.length}`,
            );
        }
    }
}

export const crypto = new Crypto();
