import { beforeAll, describe, expect, it } from "bun:test";
import {
    CalDavClient,
    CalDavFailure,
} from "../packages/platform-caldav/src/dav.js";
import { buildICalendar } from "../packages/platform-caldav/src/ical.js";
import type { CalendarDescription } from "../packages/platform-caldav/src/types.js";

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
    const runPrefix = `${uidPrefix}-${crypto.randomUUID()}`;
    const runUids = new Set([`${runPrefix}-event`, `${runPrefix}-task`]);
    const client = new CalDavClient(
        root,
        { username: "alice", password: "calendar-test-password" },
        15_000,
        { allowPrivateAddresses: true, allowInsecureHttp: true },
    );
    let calendar: CalendarDescription | undefined;
    try {
        const calendars = await client.discoverCalendars();
        calendar = calendars.find((item) => item.name === calendarName);
        expect(calendar).toBeDefined();
        if (!calendar)
            throw new Error(`${calendarName} calendar was not discovered`);

        const event = buildICalendar({
            type: "event",
            uid: `${runPrefix}-event`,
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
            uid: `${runPrefix}-task`,
            name: `${calendarName} task`,
            due: "2026-08-04",
            allDay: true,
        });
        const createdTask = await client.create(calendar, task.uid, task.body);

        const items = await client.query(calendar);
        expect(
            items
                .filter((item) => runUids.has(item.uid))
                .map((item) => item.uid)
                .sort(),
        ).toEqual([...runUids].sort());
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
        const refreshedEvent = refreshed.find((item) => item.uid === event.uid);
        expect(refreshedEvent?.name).toBe("Updated event");
        await client.delete(created.id, refreshedEvent?.etag ?? "");
        await client.delete(
            createdTask.id,
            items.find((item) => item.uid === task.uid)?.etag ??
                createdTask.etag ??
                "",
        );
        expect(
            (await client.query(calendar)).filter((item) =>
                runUids.has(item.uid),
            ),
        ).toHaveLength(0);
    } finally {
        try {
            if (calendar) {
                const remaining = (await client.query(calendar)).filter(
                    (item) => runUids.has(item.uid),
                );
                for (const item of remaining) {
                    expect(
                        item.etag,
                        `cleanup ETag missing for ${item.uid}`,
                    ).toBeDefined();
                    if (item.etag) await client.delete(item.id, item.etag);
                }
                expect(
                    (await client.query(calendar)).filter((item) =>
                        runUids.has(item.uid),
                    ),
                ).toHaveLength(0);
            }
        } finally {
            await client.close();
        }
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

async function exerciseSync(
    root: string,
    calendarName: string,
    uidPrefix: string,
): Promise<void> {
    const runPrefix = `${uidPrefix}-sync-${crypto.randomUUID()}`;
    const client = new CalDavClient(
        root,
        { username: "alice", password: "calendar-test-password" },
        15_000,
        { allowPrivateAddresses: true, allowInsecureHttp: true },
    );
    const cleanup: Array<{ id: string; etag?: string }> = [];
    try {
        const calendar = (await client.discoverCalendars()).find(
            (item) => item.name === calendarName,
        );
        if (!calendar)
            throw new Error(`${calendarName} calendar was not discovered`);
        const initial = await client.sync(calendar);
        expect(initial.syncToken).toBeTruthy();

        const event = buildICalendar({
            type: "event",
            uid: `${runPrefix}-event`,
            name: "Sync event",
            startTime: "2026-08-03T15:00:00Z",
        });
        const task = buildICalendar({
            type: "task",
            uid: `${runPrefix}-task`,
            name: "Sync task",
        });
        const createdEvent = await client.create(
            calendar,
            event.uid,
            event.body,
        );
        const createdTask = await client.create(calendar, task.uid, task.body);
        cleanup.push(createdEvent, createdTask);

        const added = await client.sync(calendar, initial.syncToken);
        expect(added.items.map((item) => item.uid).sort()).toEqual(
            [event.uid, task.uid].sort(),
        );
        expect(added.removed).toEqual([]);
        expect(added.syncToken).not.toBe(initial.syncToken);
        const storedTask = added.items.find((item) => item.uid === task.uid);
        const storedEvent = added.items.find((item) => item.uid === event.uid);
        if (!storedTask?.etag || !storedEvent?.etag)
            throw new Error("synced items have no ETag");

        const updated = await client.update(
            storedTask.id,
            storedTask.etag,
            buildICalendar({ ...storedTask, name: "Synced task", sequence: 1 })
                .body,
        );
        await client.delete(storedEvent.id, storedEvent.etag);
        cleanup.splice(0, cleanup.length, {
            id: storedTask.id,
            etag: updated.etag,
        });

        const changed = await client.sync(calendar, added.syncToken);
        expect(changed.items.map((item) => [item.uid, item.name])).toEqual([
            [task.uid, "Synced task"],
        ]);
        expect(changed.removed).toEqual([storedEvent.id]);
        const latest = changed.items[0];
        cleanup.splice(0, cleanup.length, { id: latest.id, etag: latest.etag });

        await expect(client.sync(calendar, "garbage")).rejects.toEqual(
            new CalDavFailure("caldav:sync-token-invalid"),
        );
    } finally {
        for (const item of cleanup)
            if (item.etag)
                await client.delete(item.id, item.etag).catch(() => {});
        await client.close();
    }
}

describe("CalDAV incremental sync", () => {
    it("reports additions, changes, and removals against Radicale", async () => {
        await exerciseSync(radicaleRoot, "Sockethub", "radicale");
    });

    it("reports additions, changes, and removals against Baikal", async () => {
        await exerciseSync(baikalRoot, "Sockethub Digest", "baikal");
    });

    it("reports a server without WebDAV Sync as unsupported", async () => {
        // Neither test server can turn RFC 6578 off, so stand in for one
        // that rejects the REPORT the way servers without it commonly do.
        const server = Bun.serve({
            port: 0,
            hostname: "127.0.0.1",
            fetch: () => new Response("Not Implemented", { status: 501 }),
        });
        const base = `http://127.0.0.1:${server.port}/`;
        const client = new CalDavClient(base, { token: "token" }, 15_000, {
            allowPrivateAddresses: true,
            allowInsecureHttp: true,
        });
        try {
            await expect(
                client.sync({
                    id: `${base}calendars/alice/work/`,
                    type: "calendar",
                    name: "Work",
                    components: ["event", "task"],
                }),
            ).rejects.toEqual(new CalDavFailure("caldav:sync-unsupported"));
        } finally {
            await client.close();
            server.stop(true);
        }
    });
});
