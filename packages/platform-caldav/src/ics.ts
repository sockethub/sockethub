import { parseICalendar } from "./ical.js";
import type { CalendarComponent, CalendarItem, QueryInput } from "./types.js";

export interface ICalendarFeed {
    name?: string;
    items: CalendarItem[];
    skipped: number;
}

const COMPONENT_NAMES: Record<string, CalendarComponent> = {
    VEVENT: "event",
    VTODO: "task",
};

function unfold(body: string): string {
    return body.replace(/\r?\n[ \t]/g, "");
}

function propertyValue(section: string, name: string): string | undefined {
    const match = section.match(
        new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, "m"),
    );
    return match?.[1]?.replace(/\r$/, "");
}

function unescapeText(value: string): string {
    return value.replaceAll(/\\([nN,;\\])/g, (_match, character: string) =>
        character === "n" || character === "N" ? "\n" : character,
    );
}

/** Instant of an item date value; date-only and floating values are read as UTC. */
function instant(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T00:00:00Z`
            : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
              ? `${value}Z`
              : value,
    ).getTime();
    return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Whether an item overlaps the requested time range, following the CalDAV
 * time-range rules: an item matches when it starts before the range ends and
 * ends after the range starts (a zero-length item matches when it starts at
 * or after the range start). Recurring items are never expanded: they match
 * while the rule can still produce an occurrence inside the range. Items
 * without any time match only when no range is given.
 */
export function matchesRange(item: CalendarItem, query: QueryInput): boolean {
    const rangeStart = instant(query.startTime);
    const rangeEnd = instant(query.endTime);
    if (rangeStart === undefined && rangeEnd === undefined) return true;
    const first = instant(item.startTime);
    const last = instant(item.endTime ?? item.due);
    const start = first ?? last;
    const end = last ?? first;
    if (start === undefined || end === undefined) return false;
    if (rangeEnd !== undefined && start >= rangeEnd) return false;
    if (rangeStart === undefined) return true;
    if (item.recurrence) {
        const until = instant(item.recurrence.until);
        return until === undefined || until >= rangeStart;
    }
    return end > start ? end > rangeStart : end >= rangeStart;
}

/**
 * Parse every event and task in a published iCalendar file (an `.ics`
 * subscription) into the item model used by CalDAV queries. Components the
 * parser cannot represent are counted in `skipped` rather than failing the
 * whole feed, since subscriptions are read-only and often third-party.
 */
export function parseICalendarFeed(
    body: string,
    sourceUrl: string,
    query: QueryInput = {},
): ICalendarFeed {
    const unfolded = unfold(body);
    if (!/^BEGIN:VCALENDAR\r?$/m.test(unfolded))
        throw new Error("not an iCalendar document");
    const calendarName = propertyValue(unfolded, "X-WR-CALNAME");
    const items: CalendarItem[] = [];
    let skipped = 0;
    for (const match of unfolded.matchAll(
        /^BEGIN:(VEVENT|VTODO)\r?\n([\s\S]*?)^END:\1\r?$/gm,
    )) {
        const component = COMPONENT_NAMES[match[1]];
        if (query.type && query.type !== component) continue;
        const section = match[2];
        const uid = propertyValue(section, "UID") ?? "";
        const recurrenceId = propertyValue(section, "RECURRENCE-ID");
        const fragment =
            encodeURIComponent(unescapeText(uid)) +
            (recurrenceId ? `/${encodeURIComponent(recurrenceId)}` : "");
        let item: CalendarItem;
        try {
            item = parseICalendar(
                `BEGIN:VCALENDAR\r\n${match[0]}\r\nEND:VCALENDAR\r\n`,
                `${sourceUrl}#${fragment}`,
            );
        } catch {
            skipped += 1;
            continue;
        }
        if (item.type === "event" && !item.startTime) {
            skipped += 1;
            continue;
        }
        item.updateSupported = false;
        if (matchesRange(item, query)) items.push(item);
    }
    return {
        ...(calendarName ? { name: unescapeText(calendarName) } : {}),
        items,
        skipped,
    };
}
