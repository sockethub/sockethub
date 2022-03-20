import { IActivityStream } from "@sockethub/schemas";
import { ISecureStoreInstance } from "../store";

export default function storeCredentials(store: ISecureStoreInstance, sessionLog: Function) {
  return (creds: IActivityStream, done: Function) => {
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
};
