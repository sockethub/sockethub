import { IActivityStream } from "@sockethub/schemas";
import { ISecureStoreInstance } from "../store";

export default function storeCredentials(store: ISecureStoreInstance, sessionLog: Function) {
  return async (creds: IActivityStream, done: Function) => {
    try {
      await store.save(creds.actor.id, creds);
    } catch (e) {
      sessionLog('error saving credentials to store ' + e);
      return done(e);
    }
    sessionLog('credentials encrypted and saved');
    done();
  };
};
