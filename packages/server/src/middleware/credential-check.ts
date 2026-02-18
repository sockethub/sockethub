import { getPlatformId } from "@sockethub/crypto";
import {
    CredentialsMismatchError,
    CredentialsNotShareableError,
    type CredentialsStoreInterface,
} from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import type { ActivityStream } from "@sockethub/schemas";
import type { MiddlewareNext } from "../middleware.js";
import { platformInstances } from "../platform-instance.js";

const log = createLogger("server:middleware:credential-check");

/**
 * Prevents a second socket from attaching to an existing persistent platform
 * instance when credentials are "empty" (e.g., unregistered IRC nick).
 */
export default function credentialCheck(
    credentialsStore: CredentialsStoreInterface,
    socketId: string,
    clientIp: string,
    isSessionActive: (sessionId: string) => boolean = () => false,
) {
    const normalizedClientIp = normalizeIp(clientIp);

    return (msg: ActivityStream, next: MiddlewareNext<ActivityStream>) => {
        const existing = platformInstances.get(
            getPlatformId(msg.context, msg.actor.id),
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
        // The data layer owns the credential semantics for this check.
        credentialsStore
            .get(msg.actor.id, undefined, { validateSessionShare: true })
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

                const scope = `${msg.context}:${msg.actor.id}`;
                if (isExpectedCredentialValidationError(err)) {
                    log.info(
                        `credential share validation rejected for ${scope} (socketId=${socketId}, validateSessionShare=true)`,
                        err.toString(),
                    );
                } else {
                    log.error(
                        `credential lookup failed for ${scope} (socketId=${socketId}, validateSessionShare=true)`,
                        err.toString(),
                    );
                }
                next(err instanceof Error ? err : new Error(String(err)));
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
