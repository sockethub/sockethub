import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";
import { toError } from "@sockethub/util/error";

import type { MiddlewareChainInterface } from "../middleware.js";

export default function storeCredentials(store: CredentialsStoreInterface) {
    return (
        creds: ActivityStream,
        done: MiddlewareChainInterface<ActivityStream>,
    ) => {
        const credentials = creds as CredentialsObject;
        try {
            store
                .save(credentials.actor.id, credentials)
                .then(() => done(creds))
                .catch((err) => done(toError(err)));
        } catch (err) {
            done(toError(err));
        }
    };
}
