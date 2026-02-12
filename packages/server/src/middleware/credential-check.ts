import { getPlatformId } from "@sockethub/crypto";
import type { CredentialsStoreInterface } from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import type { ActivityStream } from "@sockethub/schemas";
import type { MiddlewareNext } from "../middleware.js";
import { platformInstances } from "../platform-instance.js";

const log = createLogger("server:credential-check");

/**
 * Prevents a second socket from attaching to an existing persistent platform
 * instance when credentials are "empty" (e.g., unregistered IRC nick).
 */
export default function credentialCheck(
    credentialsStore: CredentialsStoreInterface,
    socketId: string,
) {
    return (msg: ActivityStream, next: MiddlewareNext<ActivityStream>) => {
        const handle = (credentialsValid: boolean) => {
            if (credentialsValid) {
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
            // `CredentialsStore.get()` enforces non-empty password validation,
            // so a successful lookup means this actor is safe to share.
            .get(msg.actor.id)
            .then(() => {
                handle(true);
            })
            .catch((err) => {
                log.error(
                    `credential lookup failed for ${msg.context}:${msg.actor.id}`,
                    err,
                );
                handle(false);
            });
    };
}
