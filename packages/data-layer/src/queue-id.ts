const REDIS_QUEUE_PREFIX = "sockethub";

// Canonical ids use ':' separators; BullMQ queue names are derived by replacing
// ':' with '-' when constructing the queue name.
export function buildQueueId(parentId: string, instanceId: string): string {
    return `${REDIS_QUEUE_PREFIX}:${parentId}:data-layer:queue:${instanceId}`;
}

export function buildCredentialsStoreId(
    parentId: string,
    sessionId: string,
): string {
    return `${REDIS_QUEUE_PREFIX}:${parentId}:data-layer:credentials-store:${sessionId}`;
}

/**
 * Field key for one actor's credentials inside a session's credential store.
 *
 * Scoped by platform as well as actor: a single session may hold credentials
 * for the same visible `actor.id` on more than one platform (e.g. an
 * `alice@example.org` that is both an IRC nick and an XMPP JID). Keyed by
 * actor alone, saving one would silently overwrite the other.
 *
 * Both sides of the fork must derive this identically — the parent resolves
 * the platform from the message `@context`, the child from the platform name
 * it was forked with, and those are the same string.
 */
export function buildCredentialsKey(platform: string, actor: string): string {
    return `${platform}:${actor}`;
}
