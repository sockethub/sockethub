import type { ActivityStream } from "@sockethub/schemas";
import { resolvePlatformId } from "@sockethub/schemas";

export interface EventMapping {
    credentials: Map<string, ActivityStream>;
    connect: Map<string, ActivityStream>;
    join: Map<string, ActivityStream>;
}

/**
 * True for the `{ error }` object the server acks a failed job with.
 */
export function isErrorResult(value: unknown): boolean {
    return (
        typeof value === "object" &&
        value !== null &&
        "error" in value &&
        Boolean((value as { error?: unknown }).error)
    );
}

/**
 * Type guard to check if an object is an ActivityStream with a valid actor.id.
 */
export function hasActorId(obj: ActivityStream): obj is ActivityStream {
    return (
        "actor" in obj &&
        obj.actor !== null &&
        typeof obj.actor === "object" &&
        "id" in obj.actor &&
        typeof obj.actor.id === "string"
    );
}

/**
 * True for the activity that reports or requests a nick change: an
 * `update` whose object is an `address`, with `actor` the old identity
 * and `target` the new one.
 */
export function isActorRename(activity: ActivityStream): boolean {
    return (
        activity?.type === "update" &&
        activity.object?.type === "address" &&
        hasActorId(activity) &&
        typeof activity.target === "object" &&
        typeof activity.target?.id === "string" &&
        activity.target.id !== activity.actor.id
    );
}

/**
 * Key for the replay maps. Scoped by platform: the same visible actor id
 * can exist on more than one platform (an `alice@example.org` that is both
 * an IRC nick and an XMPP JID), and keyed by actor alone one platform's
 * stored credentials/connect/join would replace the other's on reconnect.
 */
function getKey(content: ActivityStream) {
    const actor = content.actor?.id || content.actor;
    if (!actor) {
        throw new Error(
            `actor property not present for message type: ${content?.type}`,
        );
    }
    const target = content.target ? content.target.id || content.target : "";
    const platform = resolvePlatformId(content) ?? "";
    return `${platform}:${actor}-${target}`;
}

/**
 * In-memory storage for client state that should be replayed on reconnection.
 *
 * Security: Stored ONLY in JavaScript heap memory. Never persisted to disk,
 * localStorage, or any permanent storage. Cleared on page reload.
 */
export class ReplayStore {
    readonly events: EventMapping = {
        credentials: new Map(),
        connect: new Map(),
        join: new Map(),
    };

    recordCredentials(content: ActivityStream): void {
        if (content.object && content.object.type === "credentials") {
            this.events.credentials.set(getKey(content), content);
        }
    }

    /**
     * Stores connect/join commands and drops them again on
     * disconnect/leave, so a reconnect replays only what is still live.
     */
    recordMessage(content: ActivityStream): void {
        const key = getKey(content);
        if (content.type === "join" || content.type === "connect") {
            this.events[content.type].set(key, content);
        } else if (content.type === "leave") {
            this.events.join.delete(key);
        } else if (content.type === "disconnect") {
            this.events.connect.delete(key);
        }
    }

    /**
     * Re-keys every stored entry for the rename's `actor` on its platform to
     * its `target`. The credential object itself is left as the application
     * sent it: the server keys the live connection on a fingerprint of that
     * object, and the worker accepts the hash it was authorized with, so
     * replaying the original object under the new actor is what lands back
     * on the renamed connection. Returns the ids moved, for logging.
     */
    moveActor(rename: ActivityStream): Array<[string, string]> {
        const previousId = rename.actor.id;
        const target = rename.target as ActivityStream["actor"];
        const nextId = target.id;
        const nextName =
            typeof target.name === "string" ? target.name : undefined;
        const platform = resolvePlatformId(rename) ?? "";
        const moved: Array<[string, string]> = [];

        for (const map of Object.values(this.events)) {
            for (const [key, entry] of [...map]) {
                if (
                    !hasActorId(entry) ||
                    entry.actor.id !== previousId ||
                    (resolvePlatformId(entry) ?? "") !== platform
                ) {
                    continue;
                }
                const renamed: ActivityStream = {
                    ...entry,
                    actor: {
                        ...entry.actor,
                        id: nextId,
                        ...(nextName ? { name: nextName } : {}),
                    },
                };
                map.delete(key);
                map.set(getKey(renamed), renamed);
                moved.push([previousId, nextId]);
            }
        }
        return moved;
    }
}
