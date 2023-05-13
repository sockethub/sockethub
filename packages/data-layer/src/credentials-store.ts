import SecureStore from "secure-store-redis";
import debug, { Debugger } from "debug";
import crypto from "@sockethub/crypto";
import { RedisConfig } from "./types";

export interface CredentialsObject {
    context: string;
    type: "credentials";
    actor: {
        id: string;
        type: string;
        [x: string | number | symbol]: unknown;
    };
    object: {
        type: "credentials";
        [x: string | number | symbol]: unknown;
    };
    target?: {
        id: string;
        type: string;
        [x: string | number | symbol]: unknown;
    };
}

export interface CredentialsStoreInstance {
    get(
        actor: string,
        credentialsHash: string,
    ): Promise<CredentialsObject | undefined>;
    save(actor: string, creds: CredentialsObject): Promise<number>;
}

/**
 * Encapsulates the storing and fetching of credential objects.
 */
export default class CredentialsStore implements CredentialsStoreInstance {
    readonly uid: string;
    store: SecureStore;
    objectHash: (o: unknown) => string;
    private readonly log: Debugger;

    /**
     * @param parentId - The ID of the parent instance (eg. sockethub itself)
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
        this.initCrypto();
        this.initSecureStore(secret, redisConfig);
        this.uid = `sockethub:data-layer:credentials-store:${parentId}:${sessionId}`;
        this.log = debug(this.uid);
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
    ): Promise<CredentialsObject | undefined> {
        this.log(`get credentials for ${actor}`);
        const credentials: CredentialsObject = await this.store.get(actor);
        if (!credentials) {
            return undefined;
        }

        if (credentialHash) {
            if (credentialHash !== this.objectHash(credentials.object)) {
                return undefined;
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
