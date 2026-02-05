import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";

import type { MiddlewareChainInterface } from "../middleware.js";

function isCredentialsObject(msg: ActivityStream): msg is CredentialsObject {
    return (
        typeof msg === "object" &&
        msg !== null &&
        typeof msg.context === "string" &&
        msg.type === "credentials" &&
        typeof msg.actor?.id === "string" &&
        typeof msg.object === "object" &&
        msg.object !== null &&
        (msg.object as { type?: string }).type === "credentials"
    );
}

export default function storeCredentials(store: CredentialsStoreInterface) {
    return (
        creds: ActivityStream,
        done: MiddlewareChainInterface<ActivityStream>,
    ) => {
        if (!isCredentialsObject(creds)) {
            done(
                new Error(
                    "credential activity streams must include credentials object and actor id",
                ),
            );
            return;
        }
        try {
            store
                .save(creds.actor.id, creds)
                .then(() => done(creds))
                .catch((err) =>
                    done(err instanceof Error ? err : new Error(String(err))),
                );
        } catch (err) {
            done(err instanceof Error ? err : new Error(String(err)));
        }
    };
}
