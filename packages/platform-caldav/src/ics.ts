import { parseICalendar } from "./ical.js";
import type { CalendarComponent, CalendarItem, QueryInput } from "./types.js";

export interface ICalendarFeed {
    name?: string;
    items: CalendarItem[];
    skipped: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPONENT_NAMES: Record<string, CalendarComponent> = {
    VEVENT: "event",
    VTODO: "task",
};

/**
 * One event or task, delimited the same way as a lazy BEGIN/END match:
 * the first closing line of that component ends it, and a BEGIN with no
 * closer anywhere later is skipped so a following component can still match.
 */
function calendarComponents(
    unfolded: string,
): Array<{ name: string; block: string; section: string }> {
    const lines = unfolded.split(/\r?\n/);
    const found: Array<{ name: string; block: string; section: string }> = [];
    // Once a component name has no END later in the feed, further BEGIN lines
    // of that name cannot match either. Remembering that keeps this scan
    // linear: a global lazy regex retries from every BEGIN and is quadratic
    // on a feed of unclosed lines, which blocks the platform process.
    const exhausted = new Set<string>();
    for (let index = 0; index < lines.length; index += 1) {
        if (exhausted.size === 2) break;
        const name = /^BEGIN:(VEVENT|VTODO)$/.exec(
            lines[index].replace(/\r$/, ""),
        )?.[1];
        if (!name || exhausted.has(name)) continue;
        const closing = `END:${name}`;
        let end = index + 1;
        while (
            end < lines.length &&
            lines[end].replace(/\r$/, "") !== closing
        ) {
            end += 1;
        }
        if (end >= lines.length) {
            exhausted.add(name);
            continue;
        }
        found.push({
            name,
            section: lines.slice(index + 1, end).join("\r\n"),
            block: lines.slice(index, end + 1).join("\r\n"),
        });
        index = end;
    }
    return found;
}

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
 * without any time match only when no range is given. An all-day event with
 * no end lasts one day (RFC 5545 section 3.6.1).
 */
export function matchesRange(item: CalendarItem, query: QueryInput): boolean {
    const rangeStart = instant(query.startTime);
    const rangeEnd = instant(query.endTime);
    if (rangeStart === undefined && rangeEnd === undefined) return true;
    const first = instant(item.startTime);
    const last =
        instant(item.endTime ?? item.due) ??
        (item.type === "event" && item.allDay && first !== undefined
            ? first + DAY_MS
            : undefined);
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
    for (const match of calendarComponents(unfolded)) {
        const component = COMPONENT_NAMES[match.name];
        if (query.type && query.type !== component) continue;
        const uid = propertyValue(match.section, "UID") ?? "";
        const recurrenceId = propertyValue(match.section, "RECURRENCE-ID");
        const fragment =
            encodeURIComponent(unescapeText(uid)) +
            (recurrenceId ? `/${encodeURIComponent(recurrenceId)}` : "");
        let item: CalendarItem;
        try {
            item = parseICalendar(
                `BEGIN:VCALENDAR\r\n${match.block}\r\nEND:VCALENDAR\r\n`,
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
