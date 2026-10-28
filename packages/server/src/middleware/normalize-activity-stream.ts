import type { ActivityStream } from "@sockethub/schemas";
import { normalizeActivityStream } from "@sockethub/schemas";

import type { MiddlewareChainInterface } from "../middleware.js";

/** Accept JSON records as activity candidates, excluding arrays and null. */
function ensureObject(msg: unknown): msg is Record<string, unknown> {
    return typeof msg === "object" && msg !== null && !Array.isArray(msg);
}

/**
 * Maximum nesting depth accepted for client-supplied messages. Validation
 * error formatting and the socket.io encoder both recurse over the message, so
 * an unbounded depth lets a single payload overflow the stack and crash the
 * server.
 */
export const MAX_MESSAGE_DEPTH = 64;

/**
 * Iteratively check whether a value nests deeper than `max` levels. Must not
 * recurse itself, since it guards the recursive code paths.
 */
export function exceedsDepth(root: unknown, max = MAX_MESSAGE_DEPTH): boolean {
    const stack: Array<[unknown, number]> = [[root, 0]];
    while (stack.length > 0) {
        const [value, depth] = stack.pop() as [unknown, number];
        if (value === null || typeof value !== "object") {
            continue;
        }
        if (depth > max) {
            return true;
        }
        for (const child of Object.values(value)) {
            stack.push([child, depth + 1]);
        }
    }
    return false;
}

/** Reject malformed or over-deep input before normalizing an activity. */
export default function normalizeActivityStreamMiddleware<
    T extends ActivityStream,
>(msg: T, done: MiddlewareChainInterface<T>) {
    if (!ensureObject(msg)) {
        done(new Error("message received is not an object."));
    } else if (exceedsDepth(msg)) {
        done(new Error("activity stream nesting too deep."));
    } else if (
        !Array.isArray(msg["@context"]) ||
        !msg["@context"].every((entry) => typeof entry === "string")
    ) {
        done(new Error("activity stream must contain an @context array."));
    } else if (typeof msg.type !== "string") {
        done(new Error("activity stream must contain a type property."));
    } else {
        const msgStream = normalizeActivityStream(msg) as T;
        if (!msgStream.actor) {
            done(new Error("activity stream must contain an actor property."));
        } else {
            done(msgStream);
        }
    }
}
