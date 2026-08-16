import {
    CredentialsMismatchError,
    CredentialsNotShareableError,
    type CredentialsStoreInterface,
} from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import { type ActivityStream, resolvePlatformId } from "@sockethub/schemas";
import { getPlatformId } from "@sockethub/util/crypto";
import { toError } from "@sockethub/util/error";
import type { MiddlewareNext } from "../middleware.js";
import { platformInstances } from "../platform-instance.js";

/**
 * Gates a second socket attaching to an existing persistent platform instance.
 *
 * Two conditions must hold for an attach to be allowed:
 *
 *  1. The attaching session's credentials are not "empty" (e.g. an
 *     unregistered IRC nick), which is what the original guard checked.
 *  2. Those credentials *match the ones that opened the connection*. Without
 *     this, knowing an `actor.id` plus any non-empty password was enough to
 *     join another client's live connection — sending as them and receiving
 *     their inbound traffic, since platform emits fan out to every registered
 *     session. The child reports its `credentialsHash` over IPC precisely so
 *     this comparison can happen here, *before* `registerSession()`.
 *
 * When the hash is not known yet (no credentialed call has completed — e.g.
 * two clients connecting concurrently) only (1) applies. The connection isn't
 * established at that point, so there is no traffic to expose; the first
 * successful connect publishes the hash and later attaches are checked in
 * full.
 */
export default function credentialCheck(
    credentialsStore: CredentialsStoreInterface,
    socketId: string,
    clientIp: string,
    isSessionActive: (sessionId: string) => boolean = () => false,
) {
    const normalizedClientIp = normalizeIp(clientIp);
    const sessionLog = createLogger(
        `server:middleware:credential-check:${socketId}`,
    );

    return (msg: ActivityStream, next: MiddlewareNext<ActivityStream>) => {
        // `@context` is canonical by the time validate middleware has run.
        // Fall back to an empty string so the lookup deterministically misses
        // rather than blowing up on unresolved platform IDs.
        const platformId = resolvePlatformId(msg) ?? "";
        const existing = platformInstances.get(
            getPlatformId(platformId, msg.actor.id),
        );
        const hasOtherSession =
            !!existing &&
            existing.sessions.size > 0 &&
            !existing.sessions.has(socketId);

        if (!hasOtherSession) {
            next(msg);
            return;
        }

        // Only shared-session attach attempts need credential-share validation.
        // The data layer owns the credential semantics for this check: passing
        // the incumbent's hash makes `get()` require an exact match, on top of
        // the non-empty-secret rule `validateSessionShare` applies.
        credentialsStore
            .get(msg.actor.id, existing.credentialsHash, {
                validateSessionShare: true,
            })
            .then(() => {
                next(msg);
            })
            .catch((err) => {
                if (
                    err instanceof CredentialsNotShareableError &&
                    existing &&
                    canReconnectFromSameIp(
                        existing,
                        socketId,
                        normalizedClientIp,
                        isSessionActive,
                    )
                ) {
                    // Anonymous session reconnect is allowed only when stale
                    // sessions belong to the same client IP.
                    next(msg);
                    return;
                }

                const scope = `${platformId}:${msg.actor.id}`;
                if (isExpectedCredentialValidationError(err)) {
                    sessionLog.info(
                        `credential share validation rejected for ${scope} (socketId=${socketId}, validateSessionShare=true)`,
                        err.toString(),
                    );
                } else {
                    sessionLog.error(
                        `credential lookup failed for ${scope} (socketId=${socketId}, validateSessionShare=true)`,
                        err.toString(),
                    );
                }
                next(toError(err));
            });
    };
}

function isExpectedCredentialValidationError(err: unknown): boolean {
    if (
        err instanceof CredentialsNotShareableError ||
        err instanceof CredentialsMismatchError
    ) {
        return true;
    }
    return (
        err instanceof Error &&
        err.message.startsWith("credentials not found for ")
    );
}

function normalizeIp(ip: string | undefined): string {
    if (!ip) {
        return "";
    }
    const trimmed = ip.split(",")[0].trim();
    if (trimmed.startsWith("::ffff:")) {
        return trimmed.slice(7);
    }
    return trimmed;
}

function canReconnectFromSameIp(
    existing: {
        sessions: Set<string>;
        sessionIps?: Map<string, string>;
    },
    socketId: string,
    clientIp: string,
    isSessionActive: (sessionId: string) => boolean,
): boolean {
    if (!clientIp || !existing.sessionIps) {
        return false;
    }

    let hasPriorSession = false;
    for (const sessionId of existing.sessions.values()) {
        if (sessionId === socketId) {
            continue;
        }
        hasPriorSession = true;

        if (isSessionActive(sessionId)) {
            return false;
        }

        const priorIp = normalizeIp(existing.sessionIps.get(sessionId));
        if (!priorIp || priorIp !== clientIp) {
            return false;
        }
    }

    return hasPriorSession;
}
