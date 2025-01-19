import { type CredentialsStoreInterface } from "@sockethub/data-layer/dist/credentials-store.js";
import { CredentialsObject } from "@sockethub/schemas";

import { MiddlewareChainInterface } from "../middleware.js";

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
