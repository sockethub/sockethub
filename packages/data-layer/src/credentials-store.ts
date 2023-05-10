/* eslint-disable  @typescript-eslint/no-explicit-any */
import SecureStore from "secure-store-redis";
import debug, { Debugger } from "debug";
import { IActivityStream, CallbackInterface } from "@sockethub/schemas";
import crypto from "@sockethub/crypto";
import { RedisConfigProps, RedisConfigUrl } from "./types";

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
        redisConfig: RedisConfigProps | RedisConfigUrl,
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
        redisConfig: RedisConfigProps | RedisConfigUrl,
    ) {
        this.store = new SecureStore({
            namespace: this.uid,
            secret: secret,
            redis: redisConfig,
        });
    }

    /**
     * Gets the credentials for a given actor ID
     * @param actor
     * @param credentialHash
     */
    async get(actor: string, credentialHash: string): Promise<IActivityStream> {
        this.log(`get credentials for ${actor}`);
        return new Promise((resolve, reject) => {
            this.store.get(actor, (err, credentials) => {
                if (err) {
                    return reject("credentials " + err.toString());
                }
                if (!credentials) {
                    return resolve(undefined);
                }

                if (credentialHash) {
                    if (
                        credentialHash !== this.objectHash(credentials.object)
                    ) {
                        return reject(
                            `provided credentials do not match existing platform instance for actor ${actor}`,
                        );
                    }
                }
                return resolve(credentials);
            });
        });
    }

    /**
     * Saves the credentials for a given actor ID
     * @param actor
     * @param creds
     * @param done
     */
    save(
        actor: string,
        creds: CredentialsObject,
        done: CallbackInterface,
    ): void {
        this.store.save(actor, creds, done);
    }
}
