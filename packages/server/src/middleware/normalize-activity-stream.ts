import type { ActivityStream } from "@sockethub/schemas";
import { normalizeActivityStream } from "@sockethub/schemas";

import type { MiddlewareChainInterface } from "../middleware.js";

function ensureObject(msg: unknown): msg is Record<string, unknown> {
    return typeof msg === "object" && msg !== null && !Array.isArray(msg);
}

export default function normalizeActivityStreamMiddleware<
    T extends ActivityStream,
>(msg: T, done: MiddlewareChainInterface<T>) {
    if (!ensureObject(msg)) {
        done(new Error("message received is not an object."));
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
