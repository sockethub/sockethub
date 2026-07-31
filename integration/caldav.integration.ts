import { beforeAll, describe, expect, it } from "bun:test";
import { CalDavClient } from "../packages/platform-caldav/src/dav.js";
import { buildICalendar } from "../packages/platform-caldav/src/ical.js";

const root = "http://127.0.0.1:5232/alice/";
const authorization = `Basic ${Buffer.from("alice:calendar-test-password").toString("base64")}`;
let calendarId = `${root}sockethub/`;

beforeAll(async () => {
    const response = await fetch(calendarId, {
        method: "MKCALENDAR",
        headers: { authorization, "content-type": "application/xml" },
        body: `<?xml version="1.0"?><c:mkcalendar xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:set><d:prop><d:displayname>Sockethub</d:displayname><c:supported-calendar-component-set><c:comp name="VEVENT"/><c:comp name="VTODO"/></c:supported-calendar-component-set></d:prop></d:set></c:mkcalendar>`,
    });
    if (![201, 405, 409].includes(response.status))
        throw new Error(
            `failed to prepare Radicale calendar: ${response.status}`,
        );
});

describe("CalDAV against Radicale", () => {
    it("discovers, creates, queries, updates, and deletes events and tasks", async () => {
        const client = new CalDavClient(
            root,
            { username: "alice", password: "calendar-test-password" },
            15_000,
            { allowPrivateAddresses: true, allowInsecureHttp: true },
        );
        try {
            const calendars = await client.discoverCalendars();
            const calendar = calendars.find(
                (item) => item.name === "Sockethub",
            );
            expect(calendar).toBeDefined();
            if (!calendar)
                throw new Error("Radicale calendar was not discovered");
            calendarId = calendar?.id ?? calendarId;

            const event = buildICalendar({
                type: "event",
                uid: "radicale-event",
                name: "Radicale event",
                startTime: "2026-08-03T15:00:00",
                endTime: "2026-08-03T16:00:00",
                timeZone: "Europe/Prague",
                recurrence: { frequency: "weekly", count: 2 },
                attendees: [{ email: "guest@example.test" }],
                reminders: [{ trigger: "-PT10M" }],
            });
            const created = await client.create(
                calendar,
                event.uid,
                event.body,
            );
            const task = buildICalendar({
                type: "task",
                uid: "radicale-task",
                name: "Radicale task",
                due: "2026-08-04",
                allDay: true,
            });
            const createdTask = await client.create(
                calendar,
                task.uid,
                task.body,
            );

            const items = await client.query(calendar);
            expect(items.map((item) => item.uid).sort()).toEqual([
                "radicale-event",
                "radicale-task",
            ]);
            const storedEvent = items.find((item) => item.uid === event.uid);
            expect(storedEvent?.timeZone).toBe("Europe/Prague");
            expect(storedEvent?.recurrence?.frequency).toBe("weekly");

            if (!storedEvent) throw new Error("created event was not returned");
            const updated = buildICalendar({
                ...storedEvent,
                name: "Updated event",
                sequence: 1,
            });
            await client.update(
                created.id,
                storedEvent?.etag ?? created.etag ?? "",
                updated.body,
            );
            const refreshed = await client.query(calendar, { type: "event" });
            expect(refreshed[0]?.name).toBe("Updated event");
            await client.delete(created.id, refreshed[0]?.etag ?? "");
            await client.delete(
                createdTask.id,
                items.find((item) => item.uid === task.uid)?.etag ??
                    createdTask.etag ??
                    "",
            );
            expect(await client.query(calendar)).toHaveLength(0);
        } finally {
            await client.close();
        }
    });
});
