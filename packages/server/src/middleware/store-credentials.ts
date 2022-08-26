import {IActivityStream, CallbackInterface, LogInterface} from "@sockethub/schemas";
import { CredentialsStore } from "@sockethub/data-layer";

export default function storeCredentials(
  credentialsStore: CredentialsStore,
  sessionLog: LogInterface
) {
  return (creds: IActivityStream, done: CallbackInterface) => {
    credentialsStore.save(creds.actor.id, creds, (err) => {
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
