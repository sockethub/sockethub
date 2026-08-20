/**
 * Server-derived scope for persistent platform instances.
 *
 * A persistent instance used to be keyed on `(platform, actor.id)` alone.
 * `actor.id` is chosen by the client, before it has authenticated to the
 * remote service, so knowing it was enough to select the worker holding
 * somebody else's live connection — and enough to probe which actors were
 * connected, because a hit and a miss behaved differently.
 *
 * The key now carries a value the server derived instead:
 *
 *  - credentials with a secret -> a fingerprint of the submitted credential
 *    object. Two sessions land on the same worker only when they submitted
 *    identical credentials.
 *  - anything else -> a session-derived value, so anonymous connections stay
 *    private to the session that opened them.
 *
 * Clients do not wait for a credentials acknowledgement before sending the
 * action that depends on it, so the scope is resolved through a promise
 * installed when the `credentials` event arrives — before its Redis write
 * starts — rather than read from a cache that may not be populated yet.
 */
import type { CredentialsObject } from "@sockethub/schemas";
import { crypto } from "@sockethub/util/crypto";

import listener from "./listener.js";

/** Session-derived scopes eligible for reuse after a page refresh. */
interface AnonymousRecord {
    scope: string;
    instanceId: string;
    sessionId: string;
    /**
     * Normalized client address, kept as a field rather than parsed back out
     * of the map key. An IPv6 address contains colons, so the key is not
     * safely splittable.
     */
    ip: string;
}

/** sessionId -> `platform:actorId` -> fingerprint, or null when anonymous. */
const pendingScopes = new Map<string, Map<string, Promise<string | null>>>();

/** `platform:actorId:ip` -> the session-derived scope last used for it. */
const anonymousScopes = new Map<string, AnonymousRecord>();

/** Identifies the record a session-derived scope is recorded under. */
export interface ResumptionRef {
    key: string;
    /** Carried alongside the key so it never has to be parsed back out. */
    ip: string;
}

export interface ConnectionScope {
    scope: string;
    /**
     * Set only for session-derived scopes. The caller passes it back to
     * `rememberAnonymousScope()` once it knows the instance id, so a refresh
     * of the same client can inherit this scope instead of forking a second
     * worker onto a nick the first one still holds.
     */
    resumption?: ResumptionRef;
}

export interface CredentialScopeHandle {
    resolve(credentials: CredentialsObject): void;
    reject(err: unknown): void;
}

function scopeKey(platform: string, actorId: string): string {
    return `${platform}:${actorId}`;
}

/**
 * JSON-encoded rather than delimiter-joined. `actor.id` is an unconstrained
 * string, so it may contain colons (`xmpp:alice@example.org`, an https URI) and
 * equally whatever byte a delimiter picks, NUL included; an IPv6 address
 * carries colons too. Encoding removes the question entirely, so distinct
 * tuples can never produce the same key.
 */
function buildResumptionKey(
    platform: string,
    actorId: string,
    ip: string,
): string {
    return JSON.stringify([platform, actorId, ip]);
}

/**
 * Shared with the socket layer: the resumption key depends on this and on the
 * `clientIp` the listener records producing the same value.
 */
export function normalizeIp(ip: string | undefined): string {
    if (!ip) {
        return "";
    }
    const trimmed = ip.split(",")[0].trim();
    if (trimmed.startsWith("::ffff:")) {
        return trimmed.slice(7);
    }
    return trimmed;
}

/**
 * A credential object without a secret cannot authorize sharing a connection:
 * anyone can claim an unregistered nick. Those fall back to a session-derived
 * scope, which is what keeps them private.
 */
function fingerprint(credentials: CredentialsObject): string | null {
    const object = credentials?.object as Record<string, unknown> | undefined;
    if (!object) {
        return null;
    }
    const password = object.password;
    const token = object.token;
    const hasSecret =
        (typeof password === "string" && password.length > 0) ||
        (typeof token === "string" && token.length > 0);
    if (!hasSecret) {
        return null;
    }
    // Hashed exactly as submitted, without filling in defaults first. Hashing
    // the raw object can only share too little (an extra connection);
    // normalizing first risks sharing too much, which is a security bug.
    return crypto.objectHash(object);
}

/**
 * Installs the pending scope for a session's credentials.
 *
 * Must be called before the credential write starts, and while the credentials
 * handler is still running synchronously — otherwise a `message` arriving
 * behind it finds nothing pending, falls back to the session scope, and forks
 * a second worker.
 */
export function beginCredentialScope(
    sessionId: string,
    platform: string,
    actorId: string,
): CredentialScopeHandle {
    let resolveFn: (value: string | null) => void = () => undefined;
    let rejectFn: (err: unknown) => void = () => undefined;
    const promise = new Promise<string | null>((resolve, reject) => {
        resolveFn = resolve;
        rejectFn = reject;
    });
    // A credentials failure with no action waiting on it would otherwise be an
    // unhandled rejection. Anything that does await it still sees the error.
    promise.catch(() => undefined);

    let bySession = pendingScopes.get(sessionId);
    if (!bySession) {
        bySession = new Map();
        pendingScopes.set(sessionId, bySession);
    }
    bySession.set(scopeKey(platform, actorId), promise);

    return {
        resolve: (credentials: CredentialsObject) =>
            resolveFn(fingerprint(credentials)),
        reject: (err: unknown) => rejectFn(err),
    };
}

/** Drops a session's scopes. Called when the session ends. */
export function clearSessionScopes(sessionId: string): void {
    pendingScopes.delete(sessionId);
}

function socketIsLive(sessionId: string): boolean {
    const sockets = listener.io?.sockets?.sockets;
    if (!sockets) {
        // Liveness can't be established, so assume the original client is
        // still there and decline to hand its scope to anyone.
        return true;
    }
    return sockets.has(sessionId);
}

export interface ScopeRequest {
    /**
     * Session the credentials were submitted under. Over a socket this is the
     * socket id; over HTTP it is the request's single-use session, which is
     * why it is tracked separately from `socketSessionId`.
     */
    credentialSessionId?: string;
    /** Socket id, absent for HTTP requests. */
    socketSessionId?: string;
    sessionIp?: string;
}

/**
 * Resolves the scope for a persistent action.
 *
 * Waits for this session's credentials when they are still being stored. A
 * credentials failure propagates: the action fails rather than quietly
 * becoming an anonymous worker.
 */
export async function resolveConnectionScope(
    platform: string,
    actorId: string,
    request: ScopeRequest = {},
): Promise<ConnectionScope> {
    const { credentialSessionId, socketSessionId, sessionIp } = request;
    if (credentialSessionId) {
        const pending = pendingScopes
            .get(credentialSessionId)
            ?.get(scopeKey(platform, actorId));
        if (pending) {
            const resolved = await pending;
            if (resolved) {
                return { scope: resolved };
            }
        }
    }
    return anonymousScope(platform, actorId, {
        credentialSessionId,
        socketSessionId,
        sessionIp,
    });
}

/**
 * Session-derived scope, with one exception: a client whose socket has gone
 * away may reclaim the scope it was using, provided the session that held it
 * is no longer connected and the request comes from the same address. That is
 * the rule `canReconnectFromSameIp` applied before, kept so a page refresh
 * still lands back on the existing connection.
 */
function anonymousScope(
    platform: string,
    actorId: string,
    { credentialSessionId, socketSessionId, sessionIp }: ScopeRequest,
): ConnectionScope {
    const ip = normalizeIp(sessionIp);
    // Only sockets refresh, and liveness is only knowable for a socket id, so
    // HTTP requests never inherit or record a resumable scope. Each gets its
    // own private worker, which is what a single-use session should get.
    const resumption: ResumptionRef | undefined =
        ip && socketSessionId
            ? { key: buildResumptionKey(platform, actorId, ip), ip }
            : undefined;
    if (resumption) {
        const record = anonymousScopes.get(resumption.key);
        // Reuse this session's own recorded scope, or one whose session has
        // gone away. Only a *different*, still-connected client blocks it.
        // Without the self check, the caller's second action would see the
        // record it just claimed, read itself as live, and derive a second
        // scope — landing on a new worker mid-session.
        const ownedByCaller = record?.sessionId === socketSessionId;
        if (record && (ownedByCaller || !socketIsLive(record.sessionId))) {
            return { scope: record.scope, resumption };
        }
    }
    const scope = socketSessionId ?? credentialSessionId;
    if (!scope) {
        // Without a session there is nothing to isolate on, and an empty scope
        // would collapse the key back to (platform, actor) — the very thing
        // this replaces. Every real caller supplies one.
        throw new Error(
            `cannot resolve a connection scope for ${platform} without a session`,
        );
    }
    return { scope, resumption };
}

/**
 * Records a session-derived scope so a refresh can inherit it. Tied to the
 * instance rather than a timer: `forgetAnonymousScopes()` runs from
 * `PlatformInstance.shutdown()`, so a scope can never outlive the connection
 * it points at.
 */
export function rememberAnonymousScope(
    resumption: ResumptionRef,
    scope: string,
    instanceId: string,
    sessionId: string,
): void {
    if (!scope || !sessionId) {
        return;
    }
    const existing = anonymousScopes.get(resumption.key);
    if (
        existing &&
        existing.sessionId !== sessionId &&
        socketIsLive(existing.sessionId)
    ) {
        // Another session is still connected on this (platform, actor,
        // address) and owns the record. Two anonymous sessions that collide
        // here get separate workers, and the second one's remote connect
        // usually fails — the nick is taken. Overwriting would strand the
        // first client, and worse: when the second worker is torn down,
        // forgetAnonymousScopes() would delete a record pointing at the
        // first's still-live worker, so its refresh would fork yet another.
        return;
    }
    anonymousScopes.set(resumption.key, {
        scope,
        instanceId,
        sessionId,
        ip: resumption.ip,
    });
}

/**
 * Follows an instance that has been re-keyed, e.g. after an IRC nick change.
 *
 * The record is keyed on the actor as well as the instance, so both move. Left
 * alone, the record would keep the old actor and the dead identifier: it would
 * never be matched again (the client now sends the new actor), never be
 * cleared by `forgetAnonymousScopes()`, and a refresh would fork a second
 * worker onto a nick the first one still holds.
 *
 * With no new actor to move to, the records are dropped rather than left
 * pointing at an identifier that no longer exists.
 */
export function reassignAnonymousScopes(
    fromInstanceId: string,
    toInstanceId: string,
    platform: string,
    actorId?: string,
): void {
    for (const [key, record] of [...anonymousScopes]) {
        if (record.instanceId !== fromInstanceId) {
            continue;
        }
        anonymousScopes.delete(key);
        if (!actorId) {
            continue;
        }
        anonymousScopes.set(buildResumptionKey(platform, actorId, record.ip), {
            ...record,
            instanceId: toInstanceId,
        });
    }
}

/** Drops every scope pointing at an instance that is going away. */
export function forgetAnonymousScopes(instanceId: string): void {
    for (const [key, record] of anonymousScopes) {
        if (record.instanceId === instanceId) {
            anonymousScopes.delete(key);
        }
    }
}

/** Test seam. */
export function resetConnectionScopes(): void {
    pendingScopes.clear();
    anonymousScopes.clear();
}
