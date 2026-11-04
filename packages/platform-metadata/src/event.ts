/** Scheduling facts from a page's schema.org `Event` JSON-LD. */
export interface PageEvent {
    name: string;
    startDate: string;
    endDate?: string;
    location?: string;
    url?: string;
    status?: "scheduled" | "cancelled" | "postponed" | "rescheduled";
}

const EVENT_FIELD_MAX = 500;

// A Map, not an object: page-controlled keys like "__proto__" must miss.
const EVENT_STATUS = new Map<string, PageEvent["status"]>([
    ["EventScheduled", "scheduled"],
    ["EventCancelled", "cancelled"],
    ["EventPostponed", "postponed"],
    ["EventRescheduled", "rescheduled"],
]);

function eventString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const text = value.replace(/\s+/g, " ").trim().slice(0, EVENT_FIELD_MAX);
    return text || undefined;
}

/** Flatten `Place` (name + postal address) or `VirtualLocation` (url). */
function eventLocation(value: unknown): string | undefined {
    const loc = Array.isArray(value) ? value[0] : value;
    if (typeof loc === "string") return eventString(loc);
    if (!loc || typeof loc !== "object") return undefined;
    const place = loc as Record<string, unknown>;
    if (place["@type"] === "VirtualLocation") return eventString(place.url);
    const address = place.address;
    const addressParts =
        typeof address === "string"
            ? [address]
            : address && typeof address === "object"
              ? ["streetAddress", "addressLocality", "addressRegion"].map(
                    (k) => (address as Record<string, unknown>)[k],
                )
              : [];
    // Sites often repeat the city/region inside streetAddress (Meetup), so
    // skip any part the flattened text already contains.
    const parts: string[] = [];
    for (const raw of [place.name, ...addressParts]) {
        const part = eventString(raw);
        if (part && !parts.join(", ").includes(part)) parts.push(part);
    }
    return eventString(parts.join(", "));
}

function isSchemaOrgEvent(node: Record<string, unknown>): boolean {
    const type = node["@type"];
    const types = Array.isArray(type) ? type : [type];
    return types.some((t) => typeof t === "string" && /Event$/.test(t));
}

/**
 * Pick the first schema.org `Event` (or subtype such as `MusicEvent`) out of
 * the page's JSON-LD blocks and reduce it to the scheduling facts a client
 * needs to build a calendar entry. Nodes may be bare objects, arrays, or
 * `@graph` wrappers. Returns undefined when no node carries a name and a
 * start date — a half-filled block is worth nothing to a calendar.
 */
export function schemaOrgEvent(jsonLD: unknown): PageEvent | undefined {
    // Page-controlled arrays can be huge: never spread them into push().
    const queue: unknown[] = [jsonLD];
    for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        if (Array.isArray(node)) {
            for (const child of node) queue.push(child);
            continue;
        }
        if (!node || typeof node !== "object") continue;
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj["@graph"])) {
            for (const child of obj["@graph"]) queue.push(child);
        }
        if (!isSchemaOrgEvent(obj)) continue;
        const name = eventString(obj.name);
        const startDate = eventString(obj.startDate);
        if (!name || !startDate) continue;
        const statusKey =
            typeof obj.eventStatus === "string"
                ? obj.eventStatus.split("/").pop()
                : undefined;
        return {
            name,
            startDate,
            endDate: eventString(obj.endDate),
            location: eventLocation(obj.location),
            url: eventString(obj.url),
            status: statusKey ? EVENT_STATUS.get(statusKey) : undefined,
        };
    }
    return undefined;
}
