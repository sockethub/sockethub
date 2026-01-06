import { crypto } from "@sockethub/crypto";
import type { CredentialsObject } from "@sockethub/schemas";
import debug, { type Debugger } from "debug";
import SecureStore from "secure-store-redis";

import type { RedisConfig } from "./types.js";

export interface CredentialsStoreInterface {
    get(
        actor: string,
        credentialsHash: string | undefined,
    ): Promise<CredentialsObject | undefined>;
    save(actor: string, creds: CredentialsObject): Promise<number>;
}

export async function verifySecureStore(config: RedisConfig): Promise<void> {
    const log = debug("sockethub:data-layer:credentials-store");
    const ss = new SecureStore({
        redis: config,
    });
    await ss.init();
    await ss.disconnect();
    log("redis connection verified");
}

/**
 * Secure, encrypted storage for user credentials with session-based isolation.
 *
 * Provides automatic encryption/decryption of credential objects stored in Redis,
 * ensuring that sensitive authentication data is never stored in plaintext.
 * Each session gets its own isolated credential store.
 *
 * @example
 * ```typescript
 * const store = new CredentialsStore('session123', secret, redisConfig);
 *
 * // Store credentials
 * await store.save('user@example.com', {
 *   username: 'user',
 *   password: 'secret',
 *   server: 'irc.freenode.net'
 * });
 *
 * // Retrieve credentials
 * const creds = await store.get('user@example.com', credentialsHash);
 * ```
 */
export class CredentialsStore implements CredentialsStoreInterface {
    readonly uid: string;
    store: SecureStore;
    objectHash: (o: unknown) => string;
    private readonly log: Debugger;

    /**
     * Creates a new CredentialsStore instance.
     *
     * @param parentId - Unique identifier for the parent instance (e.g. server ID)
     * @param sessionId - Client session identifier for credential isolation
     * @param secret - 32-character encryption secret for credential security
     * @param redisConfig - Redis connection configuration
     * @throws Error if secret is not exactly 32 characters
     */
    constructor(
        parentId: string,
        sessionId: string,
        secret: string,
        redisConfig: RedisConfig,
    ) {
        if (secret.length !== 32) {
            throw new Error(
                "CredentialsStore secret must be 32 chars in length",
            );
        }
        this.uid = `sockethub:data-layer:credentials-store:${parentId}:${sessionId}`;
        this.log = debug(this.uid);
        this.initCrypto();
        this.initSecureStore(secret, redisConfig);
        this.log("initialized");
    }

    initCrypto() {
        this.objectHash = crypto.objectHash;
    }

    initSecureStore(secret: string, redisConfig: RedisConfig) {
        this.store = new SecureStore({
            uid: this.uid,
            secret: secret,
            redis: redisConfig,
        });
    }

    /**
     * Gets the credentials for a given actor ID
     * @param actor
     * @param credentialsHash - Optional hash to validate credentials. If undefined, validation is skipped.
     */
    async get(
        actor: string,
        credentialsHash: string | undefined,
    ): Promise<CredentialsObject> {
        this.log(`get credentials for ${actor}`);
        const credentials: CredentialsObject = await this.store.get(actor);
        if (!credentials) {
            throw new Error(`credentials not found for ${actor}`);
        }

        if (credentialsHash) {
            if (credentialsHash !== this.objectHash(credentials.object)) {
                throw new Error(`invalid credentials for ${actor}`);
            }
        }
        return credentials;
    }

    /**
     * Saves the credentials for a given actor ID
     * @param actor
     * @param creds
     */
    async save(actor: string, creds: CredentialsObject): Promise<number> {
        return this.store.save(actor, creds);
    }
}
