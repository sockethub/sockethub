import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";
import hash from "object-hash";
import { SecretValidator } from "secure-store-redis";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // For AES, this is always 16

export function getPlatformId(
    platform: string,
    actor?: string,
    _crypto = crypto,
): string {
    if (actor) {
        return _crypto.hashFull(platform + actor);
    }
    return _crypto.hashFull(platform);
}

export class Crypto {
    randomBytes: typeof randomBytes;

    constructor() {
        this.createRandomBytes();
    }

    createRandomBytes() {
        this.randomBytes = randomBytes;
    }

    encrypt(json: unknown, secret: string): string {
        Crypto.ensureSecret(secret);
        const iv = this.randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, Buffer.from(secret), iv);
        let encrypted = cipher.update(JSON.stringify(json));

        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
    }

    decrypt(text: string, secret: string): unknown {
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

    /**
     * Full-length SHA-256 hex digest. Used where hash values act as
     * identity keys (e.g. platform instance IDs): the truncated 28-bit
     * `hash()` has a ~1% birthday-collision probability by ~2,400 distinct
     * inputs, and a collision on a platform instance ID silently routes two
     * different (platform, actor) pairs to the same instance.
     */
    hashFull(text: string): string {
        return createHash("sha256").update(text).digest("hex");
    }

    objectHash(object: object): string {
        return hash(object);
    }

    /**
     * Derive a high-entropy secret from multiple input secrets.
     * Uses SHA-256 for mixing, then encodes with a shuffled 70-char set
     * to meet SecureStoreRedis requirements and avoid weak pattern detection.
     */
    deriveSecret(...secrets: string[]): string {
        // Shuffled 70-char set - breaks sequential patterns like "123", "abc", "qwerty"
        // that would otherwise trigger SecureStoreRedis weak pattern detection
        const chars =
            "JDOwSa4kUbA6ixneEfHcBzC7&dIWZvqYPh8N1mG!05loQ2RjXF9*p@MgKuT$y#3L^s%rVt";
        const charsLength = chars.length; // 70
        const baseInput = secrets.join(":");

        // Rarely, derived output can still trip validator weak-pattern rules.
        // Retry with a deterministic salt until we produce a validator-safe secret.
        for (let counter = 0; counter < 32; counter++) {
            const hash = createHash("sha256");
            hash.update(counter === 0 ? baseInput : `${baseInput}:${counter}`);
            const bytes = hash.digest();

            let result = "";
            for (let i = 0; i < 32; i++) {
                result += chars[bytes[i] % charsLength];
            }

            try {
                const validation = SecretValidator.validate(result);
                if (validation.valid) {
                    return result;
                }
            } catch {
                // continue to next deterministic variant
            }
        }

        throw new Error("Failed to derive a validator-safe secret");
    }

    randToken(len: number): string {
        if (len > 32) {
            throw new Error(
                `crypto.randToken supports a length param of up to 32, ${len} given`,
            );
        }
        return SecretValidator.generate(len);
    }

    /**
     * Random alphanumeric identifier. Use this instead of randToken() for
     * values that end up in Redis key names, logger namespaces, HTTP headers,
     * or shell commands: randToken()'s charset includes `*?[]^@$#!`, which are
     * Redis glob metacharacters and shell specials. randToken() remains the
     * generator for secrets, where the wider charset adds entropy.
     */
    randId(len: number): string {
        if (len > 32) {
            throw new Error(
                `crypto.randId supports a length param of up to 32, ${len} given`,
            );
        }
        const chars =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        // Rejection sampling to avoid modulo bias
        const maxValidByte = 256 - (256 % chars.length);
        let id = "";
        while (id.length < len) {
            for (const byte of this.randomBytes(64)) {
                if (byte < maxValidByte) {
                    id += chars[byte % chars.length];
                    if (id.length === len) break;
                }
            }
        }
        return id;
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
