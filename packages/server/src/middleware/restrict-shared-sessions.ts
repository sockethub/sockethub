import { getPlatformId } from "@sockethub/crypto";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";

import type { MiddlewareNext } from "../middleware.js";
import { platformInstances } from "../platform-instance.js";

function isShareableCredentials(
    credentials?: CredentialsObject,
): credentials is CredentialsObject {
    if (!credentials || typeof credentials.object !== "object") {
        return false;
    }
    return Object.keys(credentials.object).length > 0;
}

export default function restrictSharedSessions(
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
