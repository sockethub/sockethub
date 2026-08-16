import {
    buildCredentialsKey,
    type CredentialsStoreInterface,
} from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";
import { resolvePlatformId } from "@sockethub/schemas";
import { toError } from "@sockethub/util/error";

import type { MiddlewareChainInterface } from "../middleware.js";

export default function storeCredentials(store: CredentialsStoreInterface) {
    return (
        creds: ActivityStream,
        done: MiddlewareChainInterface<ActivityStream>,
    ) => {
        const credentials = creds as CredentialsObject;
        try {
            // Scope by platform: the same visible actor id can exist on more
            // than one platform, and keyed by actor alone the second save
            // silently overwrote the first.
            const key = buildCredentialsKey(
                resolvePlatformId(creds) ?? "",
                credentials.actor.id,
            );
            store
                .save(key, credentials)
                .then(() => done(creds))
                .catch((err) => done(toError(err)));
        } catch (err) {
            done(toError(err));
        }
    };
}
