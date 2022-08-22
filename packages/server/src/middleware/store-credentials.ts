import {IActivityStream} from "@sockethub/schemas";
import {CallbackInterface, LogInterface} from "../basic-types";
import SecureStore from "secure-store-redis";

export default function storeCredentials(store: SecureStore, sessionLog: LogInterface) {
  return async (creds: IActivityStream, done: CallbackInterface) => {
    try {
      store.save(creds.actor.id, creds as never);
      sessionLog('credentials encrypted and saved');
      done();
    } catch (err) {
      sessionLog('error saving credentials to store ' + err);
      return done(err);
    }
  };
}
