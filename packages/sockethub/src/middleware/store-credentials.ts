import {ISecureStoreInstance} from "../store";
import {ActivityObject} from "../sockethub";

export default function storeCredentials(store: ISecureStoreInstance, sessionLog: Function) {
  return (creds: ActivityObject, done: Function) => {
    store.save(creds.actor['@id'], creds, (err) => {
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