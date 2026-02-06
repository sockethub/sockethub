import { getPlatformId } from "@sockethub/crypto";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";

import type { MiddlewareNext } from "../middleware.js";
import { platformInstances } from "../platform-instance.js";

// Treat empty credentials objects as non-shareable to prevent unauthenticated
// sessions from attaching to an existing persistent platform instance.
function isShareableCredentials(
    credentials?: CredentialsObject,
): credentials is CredentialsObject {
    if (!credentials || typeof credentials.object !== "object") {
        return false;
    }
    return Object.keys(credentials.object).length > 0;
}

/**
 * Prevents a second socket from attaching to an existing persistent platform
 * instance when credentials are "empty" (e.g., unregistered IRC nick).
 */
export default function credentialCheck(
    credentialsStore: CredentialsStoreInterface,
    socketId: string,
) {
    return (msg: ActivityStream, next: MiddlewareNext<ActivityStream>) => {
        const handle = (shareable: boolean) => {
            if (shareable) {
                next(msg);
                return;
            }

            const existing = platformInstances.get(
                getPlatformId(msg.context, msg.actor.id),
            );
            if (
                existing &&
                existing.sessions.size > 0 &&
                !existing.sessions.has(socketId)
            ) {
                next(new Error("invalid credentials"));
                return;
            }

            next(msg);
        };

        credentialsStore
            .get(msg.actor.id, undefined)
            .then((credentials) => {
                handle(isShareableCredentials(credentials));
            })
            .catch(() => {
                handle(false);
            });
    };
}
