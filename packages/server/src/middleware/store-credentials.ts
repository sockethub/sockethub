import {IActivityStream} from "@sockethub/schemas";
import { CredentialsStore } from "@sockethub/data-layer";
import {MiddlewareChainInterface} from "../middleware";

export default function storeCredentialsWrapper(
  credentialsStore: CredentialsStore
): MiddlewareChainInterface {
  return async (creds: IActivityStream): Promise<IActivityStream> => {
    await credentialsStore.save(creds.actor.id, creds);
    return creds;
  };
}
