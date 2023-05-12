/* eslint-disable  @typescript-eslint/no-explicit-any */
import SecureStore, { SecureStoreConfig } from "secure-store-redis";
import debug, { Debugger } from "debug";
import { IActivityStream } from "@sockethub/schemas";
import crypto from "@sockethub/crypto";

export interface CredentialsObject extends IActivityStream {
    type: "credentials";
    object: {
        type: "credentials";
    };
}

/**
 * Encapsulates the storing and fetching of credential objects.
 */
export default class CredentialsStore {
    readonly uid: string;
    store: SecureStore;
    objectHash: (o: any) => string;
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
        redisConfig: SecureStoreConfig['redis'],
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

    initSecureStore(
        secret: string,
        redisConfig: SecureStoreConfig['redis'],
    ) {
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
    async get(actor: string, credentialHash: string): Promise<IActivityStream | undefined> {
        this.log(`get credentials for ${actor}`);
        const credentials = await this.store.get(actor);
        if (!credentials) {
            return undefined;
        }

        if (credentialHash) {
            if (
                credentialHash !== this.objectHash(credentials.object)
            ) {
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
    async save(
        actor: string,
        creds: CredentialsObject
    ): Promise<number> {
        return this.store.save(actor, creds);
    }
}
