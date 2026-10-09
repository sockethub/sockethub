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

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

/**
 * Instant of an item date value. Date-only and floating values are read as
 * UTC. A floating local time is converted from `timeZone` when the item has
 * one; an unknown zone falls back to UTC so one bad TZID cannot fail the feed.
 */
function instant(
    value: string | undefined,
    timeZone?: string,
): number | undefined {
    if (!value) return undefined;
    if (timeZone && LOCAL_DATE_TIME.test(value)) {
        const zoned = zonedLocalToUtc(value, timeZone);
        if (zoned !== undefined) return zoned;
    }
    const parsed = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T00:00:00Z`
            : LOCAL_DATE_TIME.test(value)
              ? `${value}Z`
              : value,
    ).getTime();
    return Number.isNaN(parsed) ? undefined : parsed;
}

function zoneOffsetMs(utcMs: number, timeZone: string): number | undefined {
    try {
        const parts = Object.fromEntries(
            new Intl.DateTimeFormat("en-US", {
                timeZone,
                hourCycle: "h23",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            })
                .formatToParts(new Date(utcMs))
                .filter((part) => part.type !== "literal")
                .map((part) => [part.type, part.value]),
        );
        const year = Number(parts.year);
        const month = Number(parts.month);
        const day = Number(parts.day);
        const hour = Number(parts.hour);
        const minute = Number(parts.minute);
        const second = Number(parts.second);
        if (
            [year, month, day, hour, minute, second].some((part) =>
                Number.isNaN(part),
            )
        )
            return undefined;
        // Hour 24 is midnight at the end of that date; Date.UTC rolls it over.
        return Date.UTC(year, month - 1, day, hour, minute, second) - utcMs;
    } catch {
        return undefined;
    }
}

/** UTC instant of a local wall time in an IANA time zone. */
function zonedLocalToUtc(value: string, timeZone: string): number | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
        value,
    );
    if (!match) return undefined;
    const guess = Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6] ?? 0),
    );
    const offset = zoneOffsetMs(guess, timeZone);
    if (offset === undefined) return undefined;
    const corrected = zoneOffsetMs(guess - offset, timeZone);
    return guess - (corrected ?? offset);
}

/**
 * Whether an item overlaps the requested time range, following the CalDAV
 * time-range rules: an item matches when it starts before the range ends and
 * ends after the range starts (a zero-length item matches when it starts at
 * or after the range start). Recurring items are never expanded: they match
 * while the rule can still produce an occurrence inside the range, counting
 * the master duration past a bounded UNTIL so the last occurrence is kept
 * while it is in progress. Items without any time match only when no range
 * is given.
 */
export function matchesRange(item: CalendarItem, query: QueryInput): boolean {
    const rangeStart = instant(query.startTime);
    const rangeEnd = instant(query.endTime);
    if (rangeStart === undefined && rangeEnd === undefined) return true;
    const zone = item.timeZone;
    const first = instant(item.startTime, zone);
    const last = instant(item.endTime ?? item.due, zone);
    const start = first ?? last;
    const end = last ?? first;
    if (start === undefined || end === undefined) return false;
    if (rangeEnd !== undefined && start >= rangeEnd) return false;
    if (rangeStart === undefined) return true;
    if (item.recurrence) {
        const until = instant(item.recurrence.until);
        if (until === undefined) return true;
        return end > start
            ? until + (end - start) > rangeStart
            : until >= rangeStart;
    }
    return end > start ? end > rangeStart : end >= rangeStart;
}

const COMPONENT_BEGIN = /^BEGIN:(VEVENT|VTODO)$/;

/**
 * Events and tasks in document order. One forward pass: the first BEGIN of a
 * type that never closes marks that type exhausted, so a feed of unclosed
 * BEGIN lines stays linear. A backtracking search over the same input is
 * quadratic and would stall the shared CalDAV process.
 */
function componentBlocks(
    unfolded: string,
): Array<{ kind: "VEVENT" | "VTODO"; block: string; section: string }> {
    const lines = unfolded.split(/\r?\n/);
    const blocks: Array<{
        kind: "VEVENT" | "VTODO";
        block: string;
        section: string;
    }> = [];
    const open: Record<"VEVENT" | "VTODO", boolean> = {
        VEVENT: true,
        VTODO: true,
    };
    for (let index = 0; index < lines.length; index += 1) {
        const begin = COMPONENT_BEGIN.exec(lines[index] ?? "");
        if (!begin) continue;
        const kind = begin[1] as "VEVENT" | "VTODO";
        if (!open[kind]) continue;
        let end = index + 1;
        while (end < lines.length && lines[end] !== `END:${kind}`) end += 1;
        if (end >= lines.length) {
            open[kind] = false;
            continue;
        }
        blocks.push({
            kind,
            block: lines.slice(index, end + 1).join("\r\n"),
            section: lines.slice(index + 1, end).join("\n"),
        });
        index = end;
    }
    return blocks;
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
    for (const componentBlock of componentBlocks(unfolded)) {
        const component = COMPONENT_NAMES[componentBlock.kind];
        if (query.type && query.type !== component) continue;
        const section = componentBlock.section;
        const uid = propertyValue(section, "UID") ?? "";
        const recurrenceId = propertyValue(section, "RECURRENCE-ID");
        const fragment =
            encodeURIComponent(unescapeText(uid)) +
            (recurrenceId ? `/${encodeURIComponent(recurrenceId)}` : "");
        let item: CalendarItem;
        try {
            item = parseICalendar(
                `BEGIN:VCALENDAR\r\n${componentBlock.block}\r\nEND:VCALENDAR\r\n`,
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
