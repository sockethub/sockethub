import { crypto } from "@sockethub/crypto";
import type { CredentialsObject } from "@sockethub/schemas";
import debug, { type Debugger } from "debug";
import SecureStore from "secure-store-redis";

import type { RedisConfig } from "./types.js";

export interface CredentialsStoreInterface {
    get(
        actor: string,
        credentialsHash: string,
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
 * Encapsulates the storing and fetching of credential objects.
 */
export class CredentialsStore implements CredentialsStoreInterface {
    readonly uid: string;
    store: SecureStore;
    objectHash: (o: unknown) => string;
    private readonly log: Debugger;

    /**
     * @param parentId - The ID of the parent instance (e.g. sockethub itself)
     * @param sessionId - The ID of the session (socket.io connection)
     * @param secret - The encryption secret (parent + session secrets) must be 32 chars
     * @param redisConfig - Connect info for redis
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
     * @param credentialHash
     */
    async get(
        actor: string,
        credentialHash: string,
    ): Promise<CredentialsObject> {
        this.log(`get credentials for ${actor}`);
        const credentials: CredentialsObject = await this.store.get(actor);
        if (!credentials) {
            throw new Error(`credentials not found for ${actor}`);
        }

        if (credentialHash) {
            if (credentialHash !== this.objectHash(credentials.object)) {
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
