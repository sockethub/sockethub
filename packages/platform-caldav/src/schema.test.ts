import { describe, expect, it } from "bun:test";
import { validatePlatformSchema } from "@sockethub/schemas";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { parseICalendar } from "./ical.js";
import { PlatformCalDavSchema } from "./schema.js";

const ajv = new Ajv({ strict: false, allErrors: true });
const validateCredentials = ajv.compile(PlatformCalDavSchema.credentials);
const validateObject = ajv.compile(
    PlatformCalDavSchema.messages.properties.object,
);
const validateMessage = ajv.compile({
    allOf: [
        { type: "object", ...PlatformCalDavSchema.messages },
        PlatformCalDavSchema.messageConstraints,
    ],
});
const actor = { id: "caldav:alice", type: "person" };

describe("CalDAV schema", () => {
    it("is a valid Sockethub platform schema", () => {
        expect(validatePlatformSchema(PlatformCalDavSchema)).toBe("");
    });

    it("accepts HTTP and HTTPS credentials for server policy enforcement", () => {
        expect(
            validateCredentials({
                actor: { id: "caldav:alice", type: "person" },
                object: {
                    type: "credentials",
                    url: "https://calendar.example/dav/",
                    username: "alice",
                    password: "app-password",
                },
            }),
        ).toBeTrue();
        expect(
            validateCredentials({
                actor: { id: "caldav:alice", type: "person" },
                object: {
                    type: "credentials",
                    url: "http://calendar.example/dav/",
                    username: "alice",
                    password: "app-password",
                },
            }),
        ).toBeTrue();
        expect(
            validateCredentials({
                actor: { id: "caldav:alice", type: "person" },
                object: {
                    type: "credentials",
                    url: "https://calendar.example/dav/",
                    token: "oauth-access-token",
                },
            }),
        ).toBeTrue();
    });

    it("accepts events and completed tasks", () => {
        expect(
            validateObject({
                type: "event",
                name: "Meeting",
                startTime: "2026-08-03T15:00:00Z",
            }),
        ).toBeTrue();
        expect(
            validateObject({
                type: "event",
                name: "Recurring meeting",
                startTime: "2026-08-03T15:00:00",
                timeZone: "Europe/Prague",
                recurrence: { frequency: "weekly", byDay: ["MO"] },
                attendees: [{ email: "person@example.test", rsvp: true }],
                reminders: [{ action: "email", trigger: "-PT15M", recipients: ["person@example.test"] }],
                attachments: [{ url: "https://example.test/agenda.pdf" }],
            }),
        ).toBeTrue();
        expect(
            validateObject({
                type: "task",
                name: "Ship",
                status: "completed",
                completedTime: "2026-08-03T15:00:00Z",
            }),
        ).toBeTrue();
    });

    it("rejects incomplete completion state and unknown fields", () => {
        expect(
            validateObject({ type: "task", name: "Ship", status: "completed" }),
        ).toBeFalse();
        expect(
            validateObject({ type: "event", name: "Meeting", startTime: "x", alarm: true }),
        ).toBeFalse();
    });

    it("accepts event statuses and rejects task-only statuses on events", () => {
        const event = { type: "event", name: "Meeting", startTime: "2026-08-03T15:00:00Z" };
        for (const status of ["tentative", "confirmed", "cancelled"])
            expect(validateObject({ ...event, status })).toBeTrue();
        for (const status of ["completed", "needs-action", "in-process"])
            expect(validateObject({ ...event, status })).toBeFalse();
    });

    it("reads published iCalendar feeds without a calendar target", () => {
        expect(
            validateMessage({
                type: "read",
                actor,
                target: { id: "webcal://example.test/holidays.ics", type: "feed" },
                object: { type: "event", startTime: "2026-01-01T00:00:00Z" },
            }),
        ).toBeTrue();
        expect(
            validateMessage({
                type: "read",
                actor,
                target: { id: "https://example.test/holidays.ics", type: "feed" },
            }),
        ).toBeTrue();
        expect(
            validateMessage({
                type: "read",
                actor,
                target: { id: "https://example.test/holidays.ics", type: "calendar" },
            }),
        ).toBeFalse();
        expect(
            validateMessage({
                type: "query",
                actor,
                target: { id: "https://example.test/holidays.ics", type: "feed" },
            }),
        ).toBeFalse();
        expect(
            validateMessage({
                type: "read",
                actor,
                target: { id: "ftp://example.test/holidays.ics", type: "feed" },
            }),
        ).toBeFalse();
    });

    it("accepts sync with or without a token", () => {
        const target = { id: "https://calendar.example/dav/work/", type: "calendar" };
        expect(validateMessage({ type: "sync", actor, target })).toBeTrue();
        expect(
            validateMessage({ type: "sync", actor, target, object: { syncToken: "t1" } }),
        ).toBeTrue();
        expect(
            validateMessage({ type: "sync", actor, target, object: { syncToken: "" } }),
        ).toBeFalse();
        expect(
            validateMessage({ type: "sync", actor, target, object: { tokenOnly: true } }),
        ).toBeTrue();
        expect(
            validateMessage({
                type: "sync",
                actor,
                target,
                object: { tokenOnly: true, syncToken: "t1" },
            }),
        ).toBeFalse();
        expect(
            validateMessage({ type: "sync", actor, target, object: { tokenOnly: false } }),
        ).toBeFalse();
        expect(
            validateMessage({ type: "sync", actor, target, object: { type: "task" } }),
        ).toBeFalse();
        expect(validateMessage({ type: "sync", actor })).toBeFalse();
    });

    it("accepts a fetched all-day series whose UNTIL is a date", () => {
        const formatted = new Ajv({ strict: false, allErrors: true });
        addFormats(formatted);
        const validateResponse = formatted.compile(PlatformCalDavSchema.responses);
        const validateUpdate = formatted.compile({
            allOf: [
                { type: "object", ...PlatformCalDavSchema.messages },
                PlatformCalDavSchema.messageConstraints,
            ],
        });
        const item = parseICalendar(
            [
                "BEGIN:VCALENDAR",
                "BEGIN:VEVENT",
                "UID:trip-1",
                "SUMMARY:Trip",
                "DTSTART;VALUE=DATE:20260105",
                "DTEND;VALUE=DATE:20260106",
                "RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20260330;BYDAY=MO,WE,FR",
                "END:VEVENT",
                "END:VCALENDAR",
                "",
            ].join("\r\n"),
            "https://calendar.example/cal/trip.ics",
            '"1"',
        );
        expect(item.recurrence?.until).toBe("2026-03-30");
        expect(
            validateResponse({
                "@context": [
                    "https://sockethub.org/ns/context/platform/caldav/v1.jsonld",
                ],
                type: "collection",
                summary: "CalDAV items",
                totalItems: 1,
                items: [item],
            }),
        ).toBeTrue();
        expect(
            validateUpdate({
                type: "update",
                actor,
                target: {
                    id: "https://calendar.example/cal/",
                    type: "calendar",
                },
                object: { ...item, name: "School run" },
            }),
        ).toBeTrue();
        expect(
            formatted.compile(PlatformCalDavSchema.messages.properties.object)({
                type: "event",
                name: "Trip",
                startTime: "2026-01-05",
                allDay: true,
                recurrence: { frequency: "weekly", until: "March 30" },
            }),
        ).toBeFalse();
    });
});

it("accepts an update of a fetched event that uses standard attendee roles and lowercase weekdays", () => {
    const item = parseICalendar(
        [
            "BEGIN:VCALENDAR",
            "BEGIN:VEVENT",
            "UID:meet-1",
            "SUMMARY:Standup",
            "DTSTART:20260803T130000Z",
            "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:bob@example.com",
            "RRULE:FREQ=WEEKLY;BYDAY=mo,tu",
            "END:VEVENT",
            "END:VCALENDAR",
            "",
        ].join("\r\n"),
        "https://calendar.example/cal/meet.ics",
        '"1"',
    );
    expect(
        validateMessage({
            type: "update",
            actor,
            target: { id: "https://calendar.example/cal/", type: "calendar" },
            object: { ...item, name: "Daily sync" },
        }),
    ).toBeTrue();
});

it("validates recurrence weekStart as an unnumbered weekday", () => {
    for (const weekStart of ["MO", "TU", "WE", "TH", "FR", "SA", "SU", "1MO", "Sunday", ""]) {
        expect(validateObject({ type: "event", name: "Weeks", startTime: "2026-08-03T09:00:00Z", recurrence: { frequency: "weekly", weekStart } })).toBe(/^(MO|TU|WE|TH|FR|SA|SU)$/.test(weekStart));
    }
});
