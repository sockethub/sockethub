import SecureStore from 'secure-store-redis';
import debug, {Debugger} from 'debug';
import {IActivityStream} from "@sockethub/schemas";
import crypto from "@sockethub/crypto";
import {RedisConfigProps, RedisConfigUrl} from "./types";

/**
 * Encapsulates the storing and fetching of credential objects.
 */
export default class CredentialsStore {
  readonly uid: string;
  private readonly store: SecureStore;
  private readonly log: Debugger;
  protected initialized = false;

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
    redisConfig: RedisConfigProps | RedisConfigUrl
  ) {
    this.uid = `sockethub:data-layer:credentials-store:${parentId}:${sessionId}`;
    this.store = new SecureStore(this.uid, secret, { redis: redisConfig });
    this.log = debug(this.uid);
  }

  async init() {
    this.initialized = true;
    await this.store.init();
  }

  /**
   * Gets the credentials for a given actor ID
   * @param actor
   * @param credentialHash
   */
  async get(actor: string, credentialHash: string = undefined): Promise<IActivityStream> {
    this.log(`get credentials for ${actor}`);
    if (!this.initialized) { throw new Error('CredentialsStore not initialized'); }
    const credentials = await this.store.get(actor);
    if (!credentials) { return undefined; }

    if (credentialHash) {
      if (credentialHash !== crypto.objectHash(credentials.object)) {
        throw new Error(
          `provided credentials do not match existing platform instance for actor ${actor}`
        );
      }
    }
    return credentials;
  }

  /**
   * Saves the credentials for a given actor ID
   * @param actor
   * @param creds
   */
  async save(actor: string, creds: IActivityStream): Promise<void> {
    if (!this.initialized) { throw new Error('CredentialsStore not initialized'); }
    await this.store.save(actor, creds);
    this.log(`credentials encrypted and saved`);
  }
}