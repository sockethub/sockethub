import {
    buildCredentialsKey,
    CredentialsMismatchError,
    CredentialsNotShareableError,
    type CredentialsStoreInterface,
    SESSION_SHARE_DENIED,
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
 * The hash is not known until the incumbent's first credentialed call
 * succeeds, which spans the whole remote handshake. Attaching on the
 * non-empty rule alone during that window would fail open: registration is
 * sticky (the janitor is the only other removal path) and an already-attached
 * session skips this middleware entirely on later messages, so a session that
 * slipped in mid-handshake would still be attached — and receiving the
 * connection's traffic — once the hash finally arrived.
 *
 * So for persistent platforms we wait, briefly, for the incumbent's hash and
 * then compare; if it never arrives we fail closed. Two clients connecting
 * concurrently with the same credentials still both succeed — the second one
 * simply waits for the first to finish. Non-persistent platforms never publish
 * a hash and have no long-lived connection to join, so they keep the
 * non-empty rule alone.
 *
 * "Match" means an identical submitted credential object, not equivalent
 * effective connection settings: `secure` omitted and `secure: true` hash
 * differently and will not share. That is the contract the platform already
 * enforced for `connect`/`update` (see `platform.credentialsHash`); this
 * applies it consistently to the attach gate rather than introducing it.
 * Sharing a connection therefore requires clients to submit byte-identical
 * credentials, which is the conservative direction for an authorization
 * check.
 *
 * Known gap, pre-dating this check: `canReconnectFromSameIp` lets a
 * passwordless session past the share rules when every prior session is stale
 * and its IP matches. Client IP is weak identity — behind NAT or a shared
 * egress it is effectively no identity at all — so this remains a takeover
 * path for anonymous sessions. Left as-is here to avoid changing reconnect
 * behaviour in a security fix; worth revisiting once token auth (#1054) can
 * supply a real identity.
 */
// Bounded so a hung remote handshake can't pin a waiting session forever.
const INCUMBENT_HASH_WAIT_MS = 10000;
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

    return async (
        msg: ActivityStream,
        next: MiddlewareNext<ActivityStream>,
    ) => {
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

        let incumbentHash = existing.credentialsHash;
        if (!incumbentHash && existing.config?.persist) {
            // Mid-handshake: hold this attach until the incumbent's credentials
            // are known, rather than admitting it on the weaker rule.
            incumbentHash = await existing.waitForCredentialsHash(
                INCUMBENT_HASH_WAIT_MS,
            );
            if (!incumbentHash) {
                sessionLog.info(
                    `refusing attach to ${platformId}:${msg.actor.id} (socketId=${socketId}): ` +
                        "incumbent credentials still unknown",
                );
                next(
                    toError(
                        new CredentialsNotShareableError(SESSION_SHARE_DENIED),
                    ),
                );
                return;
            }
        }

        // Only shared-session attach attempts need credential-share validation.
        // The data layer owns the credential semantics for this check: passing
        // the incumbent's hash makes `get()` require an exact match, on top of
        // the non-empty-secret rule `validateSessionShare` applies.
        return credentialsStore
            .get(buildCredentialsKey(platformId, msg.actor.id), incumbentHash, {
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
        (err.message.startsWith("credentials not found for ") ||
            err.message === SESSION_SHARE_DENIED)
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
