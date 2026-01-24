import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type { CredentialsObject } from "@sockethub/schemas";

import type { MiddlewareChainInterface } from "../middleware.js";

export default function storeCredentials(store: CredentialsStoreInterface) {
    return (creds: CredentialsObject, done: MiddlewareChainInterface) => {
        try {
            store
                .save(creds.actor.id, creds)
                .then(() => done(creds))
                .catch((err) => done(err));
        } catch (err) {
            done(err);
        }
    };
}
