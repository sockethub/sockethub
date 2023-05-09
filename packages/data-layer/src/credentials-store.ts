/* eslint-disable  @typescript-eslint/no-explicit-any */
import SecureStore from "secure-store-redis";
import debug, { Debugger } from "debug";
import { IActivityStream, CallbackInterface } from "@sockethub/schemas";
import crypto from "@sockethub/crypto";
import { RedisConfig } from "./types";

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
   * @param secret - The encryption secret (parent + session secrets)
   * @param redisConfig - Connect info for redis
   */
  constructor(
    parentId: string,
    sessionId: string,
    secret: string,
    redisConfig: RedisConfig
  ) {
    this.uid = `sockethub:data-layer:credentials-store:${parentId}:${sessionId}`;
    this.log = debug(this.uid);
    this.initCrypto();
    this.initSecureStore(secret, redisConfig);
  }

  initCrypto() {
    this.objectHash = crypto.objectHash;
  }
  
  initSecureStore(secret, redisConfig) {
    this.store = new SecureStore(this.uid, secret, {
      redis: redisConfig
    });
  }

  /**
   * Gets the credentials for a given actor ID
   * @param actor
   * @param credentialHash
   */
  async get(actor: string, credentialHash?: string): Promise<IActivityStream> {
    this.log(`get credentials for ${actor}`);
    const credentials = await this.store.get(actor);
    if (!credentials) {
      return undefined;
    }

    if (credentialHash) {
      if (credentialHash !== this.objectHash(credentials.object)) {
        throw new Error(
          `provided credentials do not match existing platform instance for actor: ${actor}`
        );
      }
    }

    return credentials;
  }

  /**
   * Saves the credentials for a given actor ID
   * @param actor
   * @param creds
   * @param done
   */
  async save(
    actor: string,
    creds: IActivityStream,
    done: CallbackInterface
  ): Promise<void> {
    try {
      await this.store.save(actor, creds);
    } catch (err) {
      this.log("error saving credentials to stores " + err);
      throw new Error(err);
    }
    this.log(`credentials encrypted and saved`);
    return done();
  }
}
