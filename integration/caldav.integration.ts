import { beforeAll, describe, expect, it } from "bun:test";
import { CalDavClient } from "../packages/platform-caldav/src/dav.js";
import { buildICalendar } from "../packages/platform-caldav/src/ical.js";

const radicaleRoot = "http://127.0.0.1:5232/alice/";
const baikalRoot = "http://127.0.0.1:5233/dav.php/";
const authorization = `Basic ${Buffer.from("alice:calendar-test-password").toString("base64")}`;
const radicaleCalendarId = `${radicaleRoot}sockethub/`;

beforeAll(async () => {
    const response = await fetch(radicaleCalendarId, {
        method: "MKCALENDAR",
        headers: { authorization, "content-type": "application/xml" },
        body: `<?xml version="1.0"?><c:mkcalendar xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:d="DAV:"><d:set><d:prop><d:displayname>Sockethub</d:displayname><c:supported-calendar-component-set><c:comp name="VEVENT"/><c:comp name="VTODO"/></c:supported-calendar-component-set></d:prop></d:set></c:mkcalendar>`,
    });
    if (![201, 405, 409].includes(response.status))
        throw new Error(
            `failed to prepare Radicale calendar: ${response.status}`,
        );
});

async function exerciseLifecycle(
    root: string,
    calendarName: string,
    uidPrefix: string,
): Promise<void> {
    const client = new CalDavClient(
        root,
        { username: "alice", password: "calendar-test-password" },
        15_000,
        { allowPrivateAddresses: true, allowInsecureHttp: true },
    );
    try {
        const calendars = await client.discoverCalendars();
        const calendar = calendars.find((item) => item.name === calendarName);
        expect(calendar).toBeDefined();
        if (!calendar)
            throw new Error(`${calendarName} calendar was not discovered`);

        const event = buildICalendar({
            type: "event",
            uid: `${uidPrefix}-event`,
            name: `${calendarName} event`,
            startTime: "2026-08-03T15:00:00",
            endTime: "2026-08-03T16:00:00",
            timeZone: "Europe/Prague",
            recurrence: { frequency: "weekly", count: 2 },
            attendees: [{ email: "guest@example.test" }],
            reminders: [{ trigger: "-PT10M" }],
        });
        const created = await client.create(calendar, event.uid, event.body);
        const task = buildICalendar({
            type: "task",
            uid: `${uidPrefix}-task`,
            name: `${calendarName} task`,
            due: "2026-08-04",
            allDay: true,
        });
        const createdTask = await client.create(calendar, task.uid, task.body);

        const items = await client.query(calendar);
        expect(items.map((item) => item.uid).sort()).toEqual(
            [`${uidPrefix}-event`, `${uidPrefix}-task`].sort(),
        );
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
            storedEvent.etag ?? created.etag ?? "",
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
}

describe("CalDAV server compatibility", () => {
    it("completes the lifecycle against Radicale Basic auth", async () => {
        await exerciseLifecycle(radicaleRoot, "Sockethub", "radicale");
    });

    it("completes the lifecycle against Baikal Digest auth", async () => {
        await exerciseLifecycle(
            baikalRoot,
            "Sockethub Digest",
            "baikal-digest",
        );
    });
});
