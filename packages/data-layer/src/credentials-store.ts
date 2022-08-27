import SecureStore from 'secure-store-redis';
import debug, {Debugger} from 'debug';
import {IActivityStream, CallbackInterface} from "@sockethub/schemas";
import crypto from "@sockethub/crypto";
import {RedisConfigProps, RedisConfigUrl} from "./types";

/**
 * Encapsulates the storing and fetching of credential objects
 */
export default class CredentialsStore {
  readonly uid: string;
  private readonly store: SecureStore;
  private readonly log: Debugger;

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

        // if (platform.config.persist) {
        // // don't continue if we don't get credentials
        //   if (err) { return cb(err.toString()); }
        // } else if (! credentials) {
        // // also skip if this is a non-persist platform with no credentials
        //   return cb();
        // }

        if (credentialHash) {
          if (credentialHash !== crypto.objectHash(credentials.object)) {
            return reject(
              `provided credentials do not match existing platform instance for actor ${actor}`);
          }
        } else {
          // FIXME this needs to be updated back in the caller namespace
          credentialHash = crypto.objectHash(credentials.object);
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
    this.log(`save credentials for ${actor}`);
    this.store.save(actor, creds, (err) => {
      if (err) {
        return done(err);
      } else {
        return done();
      }
    });
  }
}