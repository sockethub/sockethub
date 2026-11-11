import { describe, expect, it } from "bun:test";
import { buildICalendar, parseICalendar } from "./ical.js";
import { patchICalendar } from "./patch.js";
import type { CalendarObjectInput } from "./types.js";

const now = new Date("2026-09-01T12:00:00Z");
const id = "https://calendar.example/work/meet.ics";

// An event written by another app, with properties and parameters the item
// model does not carry, a folded X- line, and an alarm with its own X- line.
const stored = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Other App//EN",
    "X-WR-CALNAME:Work",
    "BEGIN:VEVENT",
    "UID:meet-1",
    "DTSTAMP:20260101T000000Z",
    "CREATED:20250101T000000Z",
    "LAST-MODIFIED:20260101T000000Z",
    "SUMMARY:Standup",
    "LOCATION:Room 1",
    "DTSTART:20260803T130000Z",
    "DTEND:20260803T133000Z",
    "CATEGORIES:WORK,DAILY",
    "X-GOOGLE-CONFERENCE:https://meet.example/abc-defg-hij?authuser=0&hs=1",
    " 22&pli=1",
    "ATTENDEE;CN=Bob;PARTSTAT=ACCEPTED;SCHEDULE-STATUS=2.0;X-NUM-GUESTS=0:mailto:bob@example.com",
    "ATTACH;FMTTYPE=application/pdf;X-APPLE-FILENAME=a.pdf:https://files.example/a.pdf",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT10M",
    "DESCRIPTION:Soon",
    "X-WR-ALARMUID:alarm-1",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
].join("\r\n");

function patch(change: (item: CalendarObjectInput) => CalendarObjectInput) {
    const fetched = parseICalendar(stored, id, '"1"');
    const next = change({ ...fetched });
    return patchICalendar(stored, next, buildICalendar(next, now).body);
}

const lines = (body: string) => body.split("\r\n");

describe("iCalendar update patching", () => {
    it("changes only SUMMARY and the revision stamps on a rename", () => {
        const { uid, body } = patch((item) => ({ ...item, name: "Daily sync" }));
        expect(uid).toBe("meet-1");
        const before = lines(stored);
        const after = lines(body);
        const changed = (list: string[], other: string[]) =>
            list.filter((line) => !other.includes(line));
        expect(changed(before, after).sort()).toEqual(
            [
                "DTSTAMP:20260101T000000Z",
                "LAST-MODIFIED:20260101T000000Z",
                "SUMMARY:Standup",
            ].sort(),
        );
        expect(changed(after, before).sort()).toEqual(
            [
                "DTSTAMP:20260901T120000Z",
                "LAST-MODIFIED:20260901T120000Z",
                "SUMMARY:Daily sync",
            ].sort(),
        );
        // Kept lines stay in their original order, folding included.
        expect(body).toContain(
            "X-GOOGLE-CONFERENCE:https://meet.example/abc-defg-hij?authuser=0&hs=1\r\n 22&pli=1\r\n",
        );
        expect(parseICalendar(body, id)).toMatchObject({
            name: "Daily sync",
            created: "2025-01-01T00:00:00Z",
        });
    });

    it("removes a property the client omits", () => {
        const { body } = patch((item) => ({ ...item, location: undefined }));
        expect(body).not.toContain("LOCATION:");
        expect(body).toContain("CATEGORIES:WORK,DAILY\r\n");
    });

    it("rewrites a changed group from the item and keeps the rest", () => {
        const { body } = patch((item) => ({
            ...item,
            attendees: [{ email: "carol@example.com" }],
        }));
        expect(body).not.toContain("bob@example.com");
        expect(body).toContain("ATTENDEE:mailto:carol@example.com\r\n");
        expect(body).toContain("X-WR-ALARMUID:alarm-1\r\n");
        expect(body).toContain("X-APPLE-FILENAME=a.pdf");
    });

    it("replaces a stored DURATION only when the item sets an end", () => {
        const withDuration = stored.replace(
            "DTEND:20260803T133000Z",
            "DURATION:PT45M",
        );
        const run = (endTime?: string) => {
            const fetched = parseICalendar(withDuration, id);
            const next = {
                ...fetched,
                startTime: "2026-08-04T13:00:00Z",
                endTime,
            };
            return patchICalendar(
                withDuration,
                next,
                buildICalendar(next, now).body,
            ).body;
        };
        const moved = run();
        expect(moved).toContain("DTSTART:20260804T130000Z\r\n");
        expect(moved).toContain("DURATION:PT45M\r\n");
        const ended = run("2026-08-04T14:00:00Z");
        expect(ended).toContain("DTEND:20260804T140000Z\r\n");
        expect(ended).not.toContain("DURATION:");
    });

    it("adds the VTIMEZONE a new time zone needs", () => {
        const { body } = patch((item) => ({
            ...item,
            startTime: "2026-08-03T15:00:00",
            endTime: "2026-08-03T15:30:00",
            timeZone: "Europe/Berlin",
        }));
        const zone = body.indexOf("BEGIN:VTIMEZONE");
        expect(zone).toBeGreaterThan(body.indexOf("X-WR-CALNAME:Work"));
        expect(zone).toBeLessThan(body.indexOf("BEGIN:VEVENT"));
        expect(body).toContain("TZID:Europe/Berlin\r\n");
        expect(body).toContain(
            "DTSTART;TZID=Europe/Berlin:20260803T150000\r\n",
        );
        expect(body.match(/BEGIN:VTIMEZONE/g)).toHaveLength(1);
    });

    it("keeps a standard attendee role when the client sends the parsed item back", () => {
        const invited = stored.replace(
            "ATTENDEE;CN=Bob;PARTSTAT=ACCEPTED;SCHEDULE-STATUS=2.0;X-NUM-GUESTS=0:mailto:bob@example.com",
            "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;SCHEDULE-STATUS=2.0;X-NUM-GUESTS=0:mailto:bob@example.com",
        );
        const fetched = parseICalendar(invited, id, '"1"');
        expect(fetched.attendees?.[0]?.role).toBe("required");
        const next = { ...fetched, name: "Daily sync" };
        const body = patchICalendar(invited, next, buildICalendar(next, now).body).body;
        expect(body).toContain(
            "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;SCHEDULE-STATUS=2.0;X-NUM-GUESTS=0:mailto:bob@example.com\r\n",
        );
        expect(body).toContain("SUMMARY:Daily sync\r\n");
    });

    it("keeps a date-only UNTIL when renaming an all-day series", () => {
        const series = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Other App//EN",
            "BEGIN:VEVENT",
            "UID:trip-1",
            "SUMMARY:Trip",
            "DTSTART;VALUE=DATE:20260105",
            "DTEND;VALUE=DATE:20260106",
            "RRULE:FREQ=WEEKLY;UNTIL=20260330;BYDAY=MO",
            "END:VEVENT",
            "END:VCALENDAR",
            "",
        ].join("\r\n");
        const fetched = parseICalendar(series, id, '"1"');
        expect(fetched.recurrence?.until).toBe("2026-03-30");
        const next = { ...fetched, name: "School run" };
        const body = patchICalendar(
            series,
            next,
            buildICalendar(next, now).body,
        ).body;
        expect(body).toContain("RRULE:FREQ=WEEKLY;UNTIL=20260330;BYDAY=MO\r\n");
        expect(body).toContain("SUMMARY:School run\r\n");
        expect(body).not.toContain("UNTIL=20260330T");
    });

    it("replaces the whole resource when the component type changes", () => {
        const next: CalendarObjectInput = {
            type: "task",
            uid: "meet-1",
            name: "Now a task",
        };
        const generated = buildICalendar(next, now).body;
        expect(patchICalendar(stored, next, generated).body).toBe(generated);
    });
});
