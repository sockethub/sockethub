import { CredentialsStoreInterface } from "@sockethub/data-layer";
import { MiddlewareChainInterface } from "../middleware";
import { CredentialsObject } from "@sockethub/schemas";

export default function storeCredentials(store: CredentialsStoreInterface) {
    return (creds: CredentialsObject, done: MiddlewareChainInterface) => {
        try {
            store.save(creds.actor.id, creds).then(() => {
                done(creds);
            });
        } catch (err) {
            done(err);
        }
    };
}
