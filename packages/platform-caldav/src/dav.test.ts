import { afterEach, describe, expect, it } from "bun:test";
import { CalDavClient, CalDavFailure } from "./dav.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const discovery = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
 <d:response><d:href>/dav/</d:href><d:propstat><d:prop>
  <d:current-user-principal><d:href>/principals/alice/</d:href></d:current-user-principal>
 </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`;

const principal = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
 <d:response><d:href>/principals/alice/</d:href><d:propstat><d:prop>
  <c:calendar-home-set><d:href>/calendars/alice/</d:href></c:calendar-home-set>
 </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`;

const calendars = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
 <d:response><d:href>/calendars/alice/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
 <d:response><d:href>/calendars/alice/work/</d:href><d:propstat><d:prop>
  <d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>Work</d:displayname>
  <c:supported-calendar-component-set><c:comp name="VEVENT"/><c:comp name="VTODO"/></c:supported-calendar-component-set>
 </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`;

describe("CalDAV client", () => {
    it("requires HTTPS before sending credentials", () => {
        expect(
            () =>
                new CalDavClient(
                    "http://calendar.example/dav/",
                    { username: "alice", password: "secret" },
                ),
        ).toThrow(new CalDavFailure("caldav:https-required"));
    });

    it("discovers event and task calendars through the principal", async () => {
        const requests: string[] = [];
        globalThis.fetch = (async (url: URL | RequestInfo) => {
            const value = String(url);
            requests.push(value);
            const body = value.endsWith("/dav/") ? discovery : value.includes("principals") ? principal : calendars;
            return new Response(body, { status: 207, headers: { "content-type": "application/xml" } });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", { username: "alice", password: "secret" });
        const result = await client.discoverCalendars();
        await client.close();
        expect(requests).toEqual([
            "https://calendar.example/dav/",
            "https://calendar.example/principals/alice/",
            "https://calendar.example/calendars/alice/",
        ]);
        expect(result).toEqual([{ id: "https://calendar.example/calendars/alice/work/", type: "calendar", name: "Work", components: ["event", "task"] }]);
    });

    it("refuses cross-origin redirects without forwarding credentials", async () => {
        let calls = 0;
        globalThis.fetch = (async () => {
            calls += 1;
            return new Response(null, { status: 302, headers: { location: "https://evil.example/dav/" } });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", { username: "alice", password: "secret" });
        await expect(client.discoverCalendars()).rejects.toEqual(new CalDavFailure("caldav:unsafe-redirect"));
        await client.close();
        expect(calls).toBe(1);
    });

    it("falls back to the standard well-known URL", async () => {
        const requests: string[] = [];
        globalThis.fetch = (async (url: URL | RequestInfo) => {
            const value = String(url);
            requests.push(value);
            if (value.endsWith("/custom/")) return new Response(null, { status: 404 });
            const body = value.includes("principals")
                ? principal
                : value.includes("calendars")
                  ? calendars
                  : discovery;
            return new Response(body, { status: 207 });
        }) as typeof fetch;
        const client = new CalDavClient(
            "https://calendar.example/custom/",
            { username: "alice", password: "secret" },
        );
        const result = await client.discoverCalendars();
        await client.close();
        expect(requests[1]).toBe(
            "https://calendar.example/.well-known/caldav",
        );
        expect(result).toHaveLength(1);
    });

    it("creates with a collision guard and returns the ETag", async () => {
        let requestInit: RequestInit | undefined;
        globalThis.fetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
            requestInit = init;
            return new Response(null, { status: 201, headers: { etag: '"v1"' } });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", { username: "alice", password: "secret" });
        const result = await client.create(
            { id: "https://calendar.example/calendars/alice/work/", type: "calendar", name: "Work", components: ["event"] },
            "one@example.test",
            "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
        );
        await client.close();
        expect(requestInit?.method).toBe("PUT");
        expect(new Headers(requestInit?.headers).get("if-none-match")).toBe("*");
        expect(result.etag).toBe('"v1"');
        expect(result.id).toBe("https://calendar.example/calendars/alice/work/one%40example.test.ics");
    });

    it("uses bearer authentication for OAuth access tokens", async () => {
        let authorization: string | null = null;
        globalThis.fetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
            authorization = new Headers(init?.headers).get("authorization");
            return new Response(discovery, { status: 207 });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", { token: "access-token" });
        await expect(client.discoverCalendars()).rejects.toEqual(new CalDavFailure("caldav:not-caldav"));
        await client.close();
        expect(authorization).toBe("Bearer access-token");
    });

    it("queries, updates, and deletes resources with ETag guards", async () => {
        const methods: Array<{ method?: string; match: string | null }> = [];
        globalThis.fetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            methods.push({ method: init?.method, match: headers.get("if-match") });
            if (init?.method === "REPORT") {
                return new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/alice/work/item.ics</d:href><d:propstat><d:prop><d:getetag>&quot;v1&quot;</d:getetag><c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:item-1\r\nSUMMARY:Item\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n</c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`, { status: 207 });
            }
            return new Response(null, { status: init?.method === "DELETE" ? 204 : 200, headers: { etag: '"v2"' } });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", { username: "alice", password: "secret" });
        const calendar = { id: "https://calendar.example/calendars/alice/work/", type: "calendar" as const, name: "Work", components: ["event" as const] };
        expect(await client.query(calendar, { type: "event" })).toHaveLength(1);
        expect(await client.update(`${calendar.id}item.ics`, '"v1"', "data")).toMatchObject({ etag: '"v2"' });
        await client.delete(`${calendar.id}item.ics`, '"v2"');
        await client.close();
        expect(methods.map((item) => item.method)).toEqual(["REPORT", "PUT", "DELETE"]);
        expect(methods[1]?.match).toBe('"v1"');
        expect(methods[2]?.match).toBe('"v2"');
    });
});
