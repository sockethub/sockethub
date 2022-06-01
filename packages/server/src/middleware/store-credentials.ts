import { IActivityStream } from "@sockethub/schemas";
import { ISecureStoreInstance } from "../store";
import {CallbackInterface, LogInterface} from "../basic-types";

export default function storeCredentials(store: ISecureStoreInstance, sessionLog: LogInterface) {
  return (creds: IActivityStream, done: CallbackInterface) => {
    store.save(creds.actor.id, creds, (err) => {
      if (err) {
        sessionLog('error saving credentials to store ' + err);
        done(err);
      } else {
        sessionLog('credentials encrypted and saved');
        done();
      }
    });
  };
}
