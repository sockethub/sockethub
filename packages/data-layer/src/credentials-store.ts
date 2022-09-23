import SecureStore from 'secure-store-redis';
import debug, {Debugger} from 'debug';
import {IActivityStream, CallbackInterface} from "@sockethub/schemas";
import crypto from "@sockethub/crypto";
import {RedisConfigProps, RedisConfigUrl} from "./types";

/**
 * Encapsulates the storing and fetching of credential objects.
 */
export default class CredentialsStore {
  readonly uid: string;
  private readonly store: SecureStore;
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
    redisConfig: RedisConfigProps | RedisConfigUrl
  ) {
    this.uid = `sockethub:data-layer:credentials-store:${parentId}:${sessionId}`;
    this.store = new SecureStore({
      namespace: this.uid,
      secret: secret,
      redis: redisConfig
    });
    this.log = debug(this.uid);
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
        if (err) { return reject(err.toString()); }
        if (!credentials) { return resolve(undefined); }

        if (credentialHash) {
          if (credentialHash !== crypto.objectHash(credentials.object)) {
            return reject(
              `provided credentials do not match existing platform instance for actor ${actor}`);
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
  save(actor: string, creds: IActivityStream, done: CallbackInterface): void {
    this.store.save(actor, creds, (err) => {
      if (err) {
        this.log('error saving credentials to store ' + err);
        return done(err);
      } else {
        this.log(`credentials encrypted and saved`);
        return done();
      }
    });
  }
}