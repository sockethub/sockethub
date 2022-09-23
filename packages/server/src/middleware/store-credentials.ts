import {IActivityStream, CallbackInterface} from "@sockethub/schemas";
import { CredentialsStore } from "@sockethub/data-layer";

export default function storeCredentials(
  credentialsStore: CredentialsStore
) {
  return (creds: IActivityStream, done: CallbackInterface) => {
    credentialsStore.save(creds.actor.id, creds, done);
  };
}
