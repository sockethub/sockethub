import { describe, expect, it } from "bun:test";
import { validatePlatformSchema } from "@sockethub/schemas";
import Ajv from "ajv";
import { PlatformCalDavSchema } from "./schema.js";

const ajv = new Ajv({ strict: false, allErrors: true });
const validateCredentials = ajv.compile(PlatformCalDavSchema.credentials);
const validateObject = ajv.compile(
    PlatformCalDavSchema.messages.properties.object,
);

describe("CalDAV schema", () => {
    it("is a valid Sockethub platform schema", () => {
        expect(validatePlatformSchema(PlatformCalDavSchema)).toBe("");
    });

    it("accepts HTTPS credentials", () => {
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
});
