import { describe, expect, it } from "bun:test";
import { matchesRange, parseICalendarFeed } from "./ics.js";
import type { CalendarItem } from "./types.js";

const feed = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Example//Holidays//EN",
    "X-WR-CALNAME:Public Holidays\\, 2026",
    "BEGIN:VEVENT",
    "UID:new-year@example",
    "DTSTAMP:20251201T000000Z",
    "DTSTART;VALUE=DATE:20260101",
    "DTEND;VALUE=DATE:20260102",
    "SUMMARY:New Year's Day",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:standup@example",
    "DTSTAMP:20251201T000000Z",
    "DTSTART:20260105T090000Z",
    "DTEND:20260105T091500Z",
    "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260330T090000Z",
    "SUMMARY:Standup",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT5M",
    "END:VALARM",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:standup@example",
    "RECURRENCE-ID:20260112T090000Z",
    "DTSTAMP:20251201T000000Z",
    "DTSTART:20260112T100000Z",
    "DTEND:20260112T101500Z",
    "SUMMARY:Standup (moved)",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:no-summary@example",
    "DTSTART:20260201T100000Z",
    "END:VEVENT",
    "BEGIN:VTODO",
    "UID:task@example",
    "DUE:20260301T120000Z",
    "SUMMARY:File taxes",
    "STATUS:NEEDS-ACTION",
    "END:VTODO",
    "END:VCALENDAR",
    "",
].join("\r\n");
const source = "https://example.test/holidays.ics";

describe("iCalendar feed parsing", () => {
    it("lists every event and task, naming the calendar", () => {
        const result = parseICalendarFeed(feed, source);
        expect(result.name).toBe("Public Holidays, 2026");
        expect(result.skipped).toBe(1);
        expect(result.items.map((item) => item.id)).toEqual([
            `${source}#new-year%40example`,
            `${source}#standup%40example`,
            `${source}#standup%40example/20260112T090000Z`,
            `${source}#task%40example`,
        ]);
        expect(result.items[0]).toMatchObject({
            type: "event",
            name: "New Year's Day",
            startTime: "2026-01-01",
            endTime: "2026-01-02",
            allDay: true,
            updateSupported: false,
        });
        expect(result.items[1]).toMatchObject({
            recurrence: { frequency: "weekly", byDay: ["MO"], until: "2026-03-30T09:00:00Z" },
            reminders: [{ trigger: "-PT5M", action: "display" }],
        });
        expect(result.items[3]).toMatchObject({ type: "task", due: "2026-03-01T12:00:00Z", status: "needs-action" });
        for (const item of result.items) expect(item.etag).toBeUndefined();
    });

    it("filters by component type and time range without expanding recurrences", () => {
        expect(parseICalendarFeed(feed, source, { type: "task" }).items.map((item) => item.uid)).toEqual(["task@example"]);
        const january = parseICalendarFeed(feed, source, {
            startTime: "2026-01-10T00:00:00Z",
            endTime: "2026-02-01T00:00:00Z",
        });
        expect(january.items.map((item) => item.name)).toEqual(["Standup", "Standup (moved)"]);
        const april = parseICalendarFeed(feed, source, { startTime: "2026-04-01T00:00:00Z" });
        expect(april.items).toEqual([]);
    });

    it("rejects documents that are not iCalendar", () => {
        expect(() => parseICalendarFeed("<html></html>", source)).toThrow("not an iCalendar document");
        expect(parseICalendarFeed("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", source)).toEqual({ items: [], skipped: 0 });
    });

    it("still reads a later component when earlier begin lines are unclosed", () => {
        const unclosed = "BEGIN:VEVENT\r\n".repeat(30_000);
        const body = [
            "BEGIN:VCALENDAR",
            unclosed.trimEnd(),
            "BEGIN:VTODO",
            "UID:task@example",
            "SUMMARY:File taxes",
            "DUE:20260301T120000Z",
            "END:VTODO",
            "END:VCALENDAR",
            "",
        ].join("\r\n");
        const started = Date.now();
        const result = parseICalendarFeed(body, source);
        expect(Date.now() - started).toBeLessThan(1000);
        expect(result.skipped).toBe(0);
        expect(result.items.map((item) => item.uid)).toEqual(["task@example"]);
    });
});

describe("time-range matching", () => {
    const base: CalendarItem = { id: "x", uid: "x", type: "event", name: "x", updateSupported: false };
    const timed = { ...base, startTime: "2026-01-05T09:00:00Z", endTime: "2026-01-05T10:00:00Z" };

    it("follows CalDAV overlap semantics", () => {
        expect(matchesRange(timed, { startTime: "2026-01-05T10:00:00Z" })).toBeFalse();
        expect(matchesRange(timed, { startTime: "2026-01-05T09:59:00Z" })).toBeTrue();
        expect(matchesRange(timed, { endTime: "2026-01-05T09:00:00Z" })).toBeFalse();
        expect(matchesRange(timed, { endTime: "2026-01-05T09:01:00Z" })).toBeTrue();
        const instant = { ...base, startTime: "2026-01-05T09:00:00Z" };
        expect(matchesRange(instant, { startTime: "2026-01-05T09:00:00Z" })).toBeTrue();
        expect(matchesRange(instant, { startTime: "2026-01-05T09:00:01Z" })).toBeFalse();
    });

    it("handles tasks with only a due date and items without dates", () => {
        const task: CalendarItem = { ...base, type: "task", due: "2026-03-01T12:00:00Z" };
        expect(matchesRange(task, { startTime: "2026-03-01T00:00:00Z" })).toBeTrue();
        expect(matchesRange(task, { endTime: "2026-03-01T00:00:00Z" })).toBeFalse();
        expect(matchesRange(base, {})).toBeTrue();
        expect(matchesRange(base, { startTime: "2026-01-01T00:00:00Z" })).toBeFalse();
    });

    it("gives all-day events without an end a one-day duration", () => {
        const holiday = { ...base, startTime: "2026-01-01", allDay: true };
        expect(matchesRange(holiday, { startTime: "2026-01-01T12:00:00Z" })).toBeTrue();
        expect(matchesRange(holiday, { startTime: "2026-01-02T00:00:00Z" })).toBeFalse();
        const bounded = { ...holiday, endTime: "2026-01-01" };
        expect(matchesRange(bounded, { startTime: "2026-01-01T12:00:00Z" })).toBeFalse();
    });

    it("keeps open-ended recurring items inside any later range", () => {
        const weekly = { ...timed, recurrence: { frequency: "weekly" as const } };
        expect(matchesRange(weekly, { startTime: "2030-01-01T00:00:00Z" })).toBeTrue();
        expect(matchesRange(weekly, { endTime: "2026-01-05T09:00:00Z" })).toBeFalse();
    });
});
