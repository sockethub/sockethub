import {
    buildCredentialsKey,
    type CredentialsStoreInterface,
} from "@sockethub/data-layer";
import type { ActivityStream, CredentialsObject } from "@sockethub/schemas";
import { resolvePlatformId } from "@sockethub/schemas";
import { toError } from "@sockethub/util/error";

import { beginCredentialScope } from "../connection-scope.js";
import type { MiddlewareChainInterface } from "../middleware.js";

export default function storeCredentials(
    store: CredentialsStoreInterface,
    sessionId: string,
) {
    return (
        creds: ActivityStream,
        done: MiddlewareChainInterface<ActivityStream>,
    ) => {
        const credentials = creds as CredentialsObject;
        let scope: ReturnType<typeof beginCredentialScope> | undefined;
        try {
            // Scope by platform: the same visible actor id can exist on more
            // than one platform, and keyed by actor alone the second save
            // silently overwrote the first.
            const platform = resolvePlatformId(creds) ?? "";
            const key = buildCredentialsKey(platform, credentials.actor.id);
            // Installed before the write starts, and while this handler is
            // still running synchronously, so a persistent action arriving
            // behind these credentials waits for them instead of falling back
            // to an anonymous scope and forking a second worker.
            scope = beginCredentialScope(
                sessionId,
                platform,
                credentials.actor.id,
            );
            store
                .save(key, credentials)
                .then(() => {
                    scope.resolve(credentials);
                    done(creds);
                })
                .catch((err) => {
                    const error = toError(err);
                    scope?.reject(error);
                    done(error);
                });
        } catch (err) {
            const error = toError(err);
            // A synchronous throw after the scope was installed would otherwise
            // leave it pending forever, and any action awaiting it would never
            // complete or error.
            scope?.reject(error);
            done(error);
        }
    };
}
