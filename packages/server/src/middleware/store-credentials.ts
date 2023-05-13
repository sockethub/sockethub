import {
    CredentialsObject,
    CredentialsStoreInstance,
} from "@sockethub/data-layer";
import { MiddlewareChainInterface } from "../middleware";

export default function storeCredentials(store: CredentialsStoreInstance) {
    return (creds: CredentialsObject, done: MiddlewareChainInterface) => {
        try {
            store.save(creds.actor.id, creds).then(() => {
                console.log("COMPLETED");
                done(creds);
            });
        } catch (err) {
            done(err);
        }
    };
}
