import { describe, expect, it } from "bun:test";
import { buildICalendar, foldLine, isUpdateSupported, parseICalendar } from "./ical.js";

describe("iCalendar generation", () => {
    it("creates a UTC VEVENT with escaped text", () => {
        const result = buildICalendar(
            {
                type: "event",
                uid: "event-1@example.test",
                name: "Review, plan; ship",
                content: "first\nsecond",
                startTime: "2026-08-03T15:00:00+02:00",
                endTime: "2026-08-03T15:30:00+02:00",
            },
            new Date("2026-08-01T10:00:00Z"),
        );
        expect(result.body).toContain("BEGIN:VEVENT\r\n");
        expect(result.body).toContain("DTSTART:20260803T130000Z\r\n");
        expect(result.body).toContain("DTEND:20260803T133000Z\r\n");
        expect(result.body).toContain("SUMMARY:Review\\, plan\\; ship\r\n");
        expect(result.body).toContain("DESCRIPTION:first\\nsecond\r\n");
        expect(result.body.endsWith("\r\n")).toBeTrue();
        expect(
            parseICalendar(result.body, "https://calendar.example/item.ics")
                .content,
        ).toBe("first\nsecond");
    });

    it("creates an all-day event with an exclusive end date", () => {
        const { body } = buildICalendar({
            type: "event",
            name: "Holiday",
            startTime: "2026-08-03",
            endTime: "2026-08-04",
            allDay: true,
        });
        expect(body).toContain("DTSTART;VALUE=DATE:20260803");
        expect(body).toContain("DTEND;VALUE=DATE:20260804");
    });

    it("creates a completed VTODO", () => {
        const { body } = buildICalendar({
            type: "task",
            name: "Ship it",
            due: "2026-08-03T15:00:00Z",
            status: "completed",
            completedTime: "2026-08-03T14:00:00Z",
            percentComplete: 100,
        });
        expect(body).toContain("BEGIN:VTODO");
        expect(body).toContain("DUE:20260803T150000Z");
        expect(body).toContain("STATUS:COMPLETED");
        expect(body).toContain("COMPLETED:20260803T140000Z");
        expect(body).toContain("PERCENT-COMPLETE:100");
    });

    it("rejects invalid ranges and UID injection", () => {
        expect(() => buildICalendar({ type: "event", name: "x", startTime: "2026-08-04", endTime: "2026-08-03", allDay: true })).toThrow();
        expect(() => buildICalendar({ type: "task", uid: "bad\r\nUID:other", name: "x" })).toThrow();
        for (const uid of ["path/item", String.raw`path\item`, "%2F", "%252F"]) {
            expect(() => buildICalendar({ type: "task", uid, name: "x" })).toThrow(
                "invalid uid",
            );
        }
    });

    it("folds UTF-8 lines at the byte limit", () => {
        const folded = foldLine(`SUMMARY:${"é".repeat(50)}`);
        const lines = folded.split("\r\n");
        expect(Buffer.byteLength(lines[0], "utf8")).toBeLessThanOrEqual(75);
        expect(Buffer.byteLength(lines[1], "utf8")).toBeLessThanOrEqual(75);
        expect(lines[1].startsWith(" ")).toBeTrue();
    });

    it("supports named time zones, recurrence, people, reminders, and attachments", () => {
        const result = buildICalendar({
            type: "event", uid: "advanced@example.test", name: "Planning",
            startTime: "2026-08-03T15:00:00", endTime: "2026-08-03T16:00:00",
            timeZone: "Europe/Prague",
            recurrence: { frequency: "weekly", count: 4, byDay: ["MO"] },
            organizer: { email: "owner@example.test", name: "Owner" },
            attendees: [{ email: "guest@example.test", role: "required", rsvp: true }],
            reminders: [{ trigger: "-PT15M" }],
            attachments: [{ url: "https://example.test/agenda.pdf", mediaType: "application/pdf" }],
        });
        expect(result.body).toContain("DTSTART;TZID=Europe/Prague:20260803T150000");
        expect(result.body).toContain("BEGIN:VTIMEZONE\r\n");
        expect(result.body).toContain("TZID:Europe/Prague\r\n");
        expect(Buffer.byteLength(result.body)).toBeLessThan(10_000);
        expect(result.body).toContain("RRULE:FREQ=WEEKLY;COUNT=4;BYDAY=MO");
        expect(result.body).toContain("ORGANIZER;CN=Owner:mailto:owner@example.test");
        expect(result.body).toContain("BEGIN:VALARM");
        expect(result.body).toContain("ATTACH;FMTTYPE=application/pdf:https://example.test/agenda.pdf");
        expect(parseICalendar(result.body, "https://calendar.example/item.ics")).toMatchObject({
            timeZone: "Europe/Prague",
            recurrence: { frequency: "weekly", count: 4, byDay: ["MO"] },
            organizer: { email: "owner@example.test", name: "Owner" },
            attendees: [{ email: "guest@example.test", role: "required", rsvp: true }],
            reminders: [{ trigger: "-PT15M", action: "display" }],
            attachments: [{ url: "https://example.test/agenda.pdf", mediaType: "application/pdf" }],
        });
    });

    it("quotes parameters and preserves absolute alarm triggers", () => {
        const result = buildICalendar({
            type: "event",
            name: "Review",
            startTime: "2026-08-03T13:00:00Z",
            attendees: [{ email: "guest@example.test", name: "Smith; John" }],
            reminders: [{ trigger: "2026-08-03T12:45:00Z" }],
        });
        expect(result.body).toContain('ATTENDEE;CN="Smith; John":mailto:guest@example.test');
        expect(result.body).toContain("TRIGGER;VALUE=DATE-TIME:20260803T124500Z");
        expect(parseICalendar(result.body, "https://calendar.example/item.ics")).toMatchObject({
            attendees: [{ email: "guest@example.test", name: "Smith; John" }],
            reminders: [{ trigger: "2026-08-03T12:45:00Z" }],
        });
    });

    it("rejects content-line injection in direct values", () => {
        expect(() =>
            buildICalendar({
                type: "event",
                name: "Injected",
                startTime: "2026-08-03T13:00:00Z",
                attachments: [
                    { data: "QUFB\r\nATTENDEE:mailto:evil@example.test" },
                ],
            }),
        ).toThrow("invalid attachment.data");
        expect(() =>
            buildICalendar({
                type: "event",
                name: "Injected",
                startTime: "2026-08-03T13:00:00Z",
                attendees: [{ email: "safe@example.test\r\nBEGIN:VALARM" }],
            }),
        ).toThrow("invalid attendee.email");
    });

    it("skips malformed optional properties instead of fabricating values", () => {
        const body = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:one\r\nSUMMARY:One\r\nDTSTART:20260803T130000Z\r\nDUE:20260804T130000Z\r\nSTATUS:CONFIRMED\r\nSEQUENCE:nope\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        expect(
            parseICalendar(body, "https://calendar.example/one.ics"),
        ).toEqual({
            id: "https://calendar.example/one.ics",
            type: "event",
            uid: "one",
            name: "One",
            startTime: "2026-08-03T13:00:00Z",
            updateSupported: true,
        });
    });

    it("round-trips literal text and parameter escape sequences", () => {
        const generated = buildICalendar({
            type: "event",
            name: String.raw`literal \n and slash \\`,
            startTime: "2026-08-03T13:00:00Z",
            attendees: [{ email: "a@example.test", name: `caret ^ and "quote"` }],
        });
        expect(
            parseICalendar(generated.body, "https://calendar.example/one.ics"),
        ).toMatchObject({
            name: String.raw`literal \n and slash \\`,
            attendees: [
                { email: "a@example.test", name: `caret ^ and "quote"` },
            ],
        });
    });

    it("marks resources unsafe to rewrite when recurrence data would be lost", () => {
        const simple = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:one\r\nSUMMARY:One\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        expect(isUpdateSupported(simple)).toBeTrue();
        expect(isUpdateSupported(simple.replace("SUMMARY:One", "EXDATE:20260804T100000Z\r\nSUMMARY:One"))).toBeFalse();
        expect(isUpdateSupported(simple.replace("END:VCALENDAR", "BEGIN:VEVENT\r\nUID:two\r\nSUMMARY:Two\r\nEND:VEVENT\r\nEND:VCALENDAR"))).toBeFalse();
        expect(parseICalendar(simple.replace("SUMMARY:One", "DESCRIPTION:BEGIN:VTODO\r\nSUMMARY:One"), "https://calendar.example/one.ics").type).toBe("event");
        const withTimeZoneRDate = simple.replace(
            "BEGIN:VEVENT",
            "BEGIN:VTIMEZONE\r\nTZID:X\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nRDATE:19710101T000000\r\nTZOFFSETFROM:+0000\r\nTZOFFSETTO:+0000\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT",
        );
        expect(isUpdateSupported(withTimeZoneRDate)).toBeTrue();
    });

    it("parses items returned by a CalDAV server", () => {
        const generated = buildICalendar({ type: "task", uid: "task-1", name: "Do it", due: "2026-08-04", allDay: true });
        expect(parseICalendar(generated.body, "https://calendar.example/tasks/task-1.ics", '"v1"')).toMatchObject({
            id: "https://calendar.example/tasks/task-1.ics", etag: '"v1"', type: "task", uid: "task-1", name: "Do it", due: "2026-08-04",
        });
    });
});
