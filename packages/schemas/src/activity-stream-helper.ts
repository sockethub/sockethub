import type { ActivityStream } from "./types.js";

const stringRefKeys = {
    actor: "id",
    target: "id",
    object: "content",
} as const;

type StreamPartKey = keyof typeof stringRefKeys;

function normalizeStringRef(value: unknown, primaryKey: string): unknown {
    if (typeof value === "string") {
        return { [primaryKey]: value };
    }
    if (Array.isArray(value)) {
        return value.map((entry) => {
            if (typeof entry === "string") {
                return { id: entry };
            }
            return entry;
        });
    }
    return value;
}

/**
 * Normalize string actor/target/object refs into minimal ActivityObjects.
 */
export function normalizeActivityStream(meta: ActivityStream): ActivityStream {
    const stream: Record<string, unknown> = {
        ...(meta as unknown as Record<string, unknown>),
    };
    for (const key of Object.keys(stringRefKeys) as StreamPartKey[]) {
        if (key in stream) {
            stream[key] = normalizeStringRef(stream[key], stringRefKeys[key]);
        }
    }
    return stream as ActivityStream;
}
