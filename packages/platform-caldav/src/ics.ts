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

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
/**
 * Shortest length of each month. February is 28, so a day that exists only
 * in a leap February is treated as one that can skip a period.
 */
const MIN_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function positiveInterval(interval: number | undefined): number {
    return interval !== undefined && Number.isInteger(interval) && interval >= 1
        ? interval
        : 1;
}

function ruleByDay(byDay: string[] | undefined): string[] {
    return (byDay ?? []).map((day) => day.trim().toUpperCase());
}

function monthAlwaysFits(month: number, day: number): boolean {
    const need = Math.abs(day);
    return Number.isInteger(day) && need >= 1 && need <= MIN_MONTH_DAYS[month];
}

function dayFitsEveryMonth(day: number): boolean {
    return MIN_MONTH_DAYS.every((_, month) => monthAlwaysFits(month, day));
}

/**
 * Months from a valid month to the next month that can host one of the
 * limit days, stepping by `interval`. The walk is at most a year of steps,
 * which always returns to the month it started from.
 */
function maxMonthStep(
    interval: number,
    fits: (month: number) => boolean,
): number {
    let worst = interval;
    for (let startMonth = 0; startMonth < 12; startMonth += 1) {
        if (!fits(startMonth)) continue;
        let gap = 0;
        let month = startMonth;
        for (let step = 0; step < 12; step += 1) {
            gap += interval;
            month += interval;
            const normalized = ((month % 12) + 12) % 12;
            if (fits(normalized)) {
                worst = Math.max(worst, gap);
                break;
            }
        }
    }
    return worst;
}

function addUtcMonths(utcMs: number, months: number): number {
    const date = new Date(utcMs);
    const monthIndex = date.getUTCMonth() + months;
    const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12;
    return Date.UTC(
        year,
        month,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds(),
    );
}

function addUtcYears(utcMs: number, years: number): number {
    const date = new Date(utcMs);
    return Date.UTC(
        date.getUTCFullYear() + years,
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds(),
    );
}

function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Years from a leap day until `count` leap days, stepping by `interval`. */
function leapDaySpanYears(
    startYear: number,
    count: number,
    interval: number,
): number {
    let year = startYear;
    let found = 1;
    let steps = 0;
    // Eight years is the longest gap between leap days (a skipped century).
    while (found < count && steps < count * 8) {
        year += interval;
        steps += 1;
        if (isLeapYear(year)) found += 1;
    }
    return year - startYear;
}

function byDaySkipsMonths(byDay: string[]): boolean {
    return byDay.some((day) => /^[+-]?5/.test(day));
}

/**
 * How much later in a later month the same ordinal weekday can fall.
 * The 1st–4th weekday moves by at most 6 days; a last-weekday (negative
 * ordinal) moves by at most 9, from the 22nd through the 31st.
 */
function ordinalShiftMs(byDay: string[]): number {
    let days = 0;
    for (const day of byDay) {
        if (/^-\d/.test(day)) days = Math.max(days, 9);
        else if (/^\+?\d/.test(day)) days = Math.max(days, 6);
    }
    return days * DAY_MS;
}

function coversStartWeekday(byDay: string[], start: number): boolean {
    const weekday = WEEKDAYS[new Date(start).getUTCDay()];
    return byDay.some((day) => day === weekday);
}

/**
 * Days a daily BYDAY limit can put between occurrences. A step that is not
 * a whole number of weeks hits a given weekday every `interval` weeks.
 */
function dailyByDaySpanMs(
    start: number,
    byDay: string[],
    count: number,
    interval: number,
): number {
    const stride = interval % 7 === 0 ? interval : interval * 7;
    const steps = coversStartWeekday(byDay, start) ? count - 1 : count;
    return Math.max(steps, 0) * stride * DAY_MS;
}

function monthlyCountBound(
    start: number,
    count: number,
    interval: number,
    byDay: string[],
    byMonthDay: number[] | undefined,
): number {
    const gaps = count - 1;
    const days =
        byMonthDay && byMonthDay.length > 0
            ? byMonthDay
            : [new Date(start).getUTCDate()];
    const skipsMonths = byDaySkipsMonths(byDay);
    const always = days.some((day) => dayFitsEveryMonth(day));
    let months: number;
    if (skipsMonths) months = gaps * interval * 12;
    else if (!always)
        months =
            gaps *
            maxMonthStep(interval, (month) =>
                days.some((day) => monthAlwaysFits(month, day)),
            );
    else months = gaps * interval;
    // A 5th weekday, or a day missing from short months, is already covered
    // by landing in a later month. Ordinal weekdays that occur every month
    // only move within the month.
    // Negative month days are counted from the end, so a February 28th can
    // be followed by the 31st. That is at most three days later.
    const monthDayShift =
        always && days.some((day) => day < 0) ? 3 * DAY_MS : 0;
    const shift =
        skipsMonths || !always || gaps === 0
            ? 0
            : ordinalShiftMs(byDay) + monthDayShift;
    return addUtcMonths(start, months) + shift + DAY_MS;
}

function yearlyCountBound(
    start: number,
    count: number,
    interval: number,
): number {
    const date = new Date(start);
    const years =
        date.getUTCMonth() === 1 && date.getUTCDate() === 29
            ? leapDaySpanYears(date.getUTCFullYear(), count, interval)
            : (count - 1) * interval;
    return addUtcYears(start, years) + DAY_MS;
}

/**
 * Latest instant at which a bounded rule can still start an occurrence, or
 * undefined for an unbounded rule. UNTIL is taken as given. COUNT is not
 * expanded: the bound is the latest start the rule can reach, so a skipped
 * month or a weekday limit cannot hide a later occurrence. It may fall
 * after the true last start.
 */
function lastOccurrenceBound(
    recurrence: NonNullable<CalendarItem["recurrence"]>,
    start: number,
): number | undefined {
    const until = instant(recurrence.until);
    if (until !== undefined) return until;
    const count = recurrence.count;
    if (count === undefined) return undefined;
    if (!Number.isInteger(count) || count < 1) return start;
    const interval = positiveInterval(recurrence.interval);
    const byDay = ruleByDay(recurrence.byDay);
    switch (recurrence.frequency) {
        case "daily":
            if (byDay.length > 0)
                return start + dailyByDaySpanMs(start, byDay, count, interval);
            return start + (count - 1) * interval * DAY_MS;
        case "weekly":
            return (
                start +
                (count - 1) * interval * 7 * DAY_MS +
                (byDay.length > 0 && !coversStartWeekday(byDay, start)
                    ? 6 * DAY_MS
                    : 0)
            );
        case "monthly":
            return monthlyCountBound(
                start,
                count,
                interval,
                byDay,
                recurrence.byMonthDay,
            );
        case "yearly":
            return yearlyCountBound(start, count, interval);
        default:
            // Frequencies this model does not expand (hourly, minutely) keep
            // the previous one-day ceiling rather than matching forever.
            return start + DAY_MS;
    }
}

/**
 * Whether an item overlaps the requested time range, following the CalDAV
 * time-range rules: an item matches when it starts before the range ends and
 * ends after the range starts (a zero-length item matches when it starts at
 * or after the range start). Recurring items are never expanded: they match
 * while the rule can still produce an occurrence inside the range: a bounded
 * rule (UNTIL or COUNT) stops matching once its last possible occurrence,
 * including the master duration, has ended. Items without any time match
 * only when no range is given. An all-day event with no end lasts one day
 * (RFC 5545 section 3.6.1).
 */
export function matchesRange(item: CalendarItem, query: QueryInput): boolean {
    const rangeStart = instant(query.startTime);
    const rangeEnd = instant(query.endTime);
    if (rangeStart === undefined && rangeEnd === undefined) return true;
    const zone = item.timeZone;
    const first = instant(item.startTime, zone);
    const last =
        instant(item.endTime ?? item.due, zone) ??
        (item.type === "event" && item.allDay && first !== undefined
            ? first + DAY_MS
            : undefined);
    const start = first ?? last;
    const end = last ?? first;
    if (start === undefined || end === undefined) return false;
    if (rangeEnd !== undefined && start >= rangeEnd) return false;
    if (rangeStart === undefined) return true;
    if (item.recurrence) {
        const lastStart = lastOccurrenceBound(item.recurrence, start);
        if (lastStart === undefined) return true;
        return end > start
            ? lastStart + (end - start) > rangeStart
            : lastStart >= rangeStart;
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
    if (
        !/^BEGIN:VCALENDAR\r?$/m.test(unfolded) ||
        !/^END:VCALENDAR\r?$/m.test(unfolded)
    )
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
