import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
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
        expect(
            () =>
                new CalDavClient(
                    "http://calendar.example/dav/",
                    { username: "alice", password: "secret" },
                    15_000,
                    { allowInsecureHttp: true },
                ),
        ).not.toThrow();
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

    it("does not expand entities in untrusted XML responses", async () => {
        const requests: string[] = [];
        globalThis.fetch = (async (url: URL | RequestInfo) => {
            requests.push(String(url));
            return new Response(
                `<?xml version="1.0"?>
<!DOCTYPE multistatus [<!ENTITY principal "/principals/alice/">]>
<d:multistatus xmlns:d="DAV:">
 <d:response><d:propstat><d:prop>
  <d:current-user-principal><d:href>&principal;</d:href></d:current-user-principal>
 </d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`,
                { status: 207 },
            );
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", {
            username: "alice",
            password: "secret",
        });
        await expect(client.discoverCalendars()).rejects.toEqual(
            new CalDavFailure("caldav:not-caldav"),
        );
        await client.close();
        expect(requests).toEqual([
            "https://calendar.example/dav/",
            "https://calendar.example/dav/&principal;",
            "https://calendar.example/.well-known/caldav",
            "https://calendar.example/.well-known/&principal;",
        ]);
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

    it("does not replay writes across non-preserving redirects", async () => {
        let calls = 0;
        globalThis.fetch = (async () => {
            calls += 1;
            return new Response(null, {
                status: 303,
                headers: { location: "/other/item.ics" },
            });
        }) as typeof fetch;
        const client = new CalDavClient(
            "https://calendar.example/dav/",
            { username: "alice", password: "secret" },
        );
        await expect(
            client.create(
                {
                    id: "https://calendar.example/calendars/alice/work/",
                    type: "calendar",
                    name: "Work",
                    components: ["event"],
                },
                "one",
                "data",
            ),
        ).rejects.toEqual(new CalDavFailure("caldav:unsafe-redirect"));
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

    it("negotiates Digest authentication for username credentials", async () => {
        const authorizations: Array<string | null> = [];
        globalThis.fetch = (async (url: URL | RequestInfo, init?: RequestInit) => {
            const authorization = new Headers(init?.headers).get("authorization");
            authorizations.push(authorization);
            if (!authorization) {
                return new Response(null, {
                    status: 401,
                    headers: {
                        "www-authenticate":
                            'Digest realm="BaikalDAV", nonce="server-nonce", algorithm=MD5, qop="auth", opaque="opaque-value"',
                    },
                });
            }
            const value = String(url);
            const body = value.includes("principals")
                ? principal
                : value.includes("calendars")
                  ? calendars
                  : discovery;
            return new Response(body, { status: 207 });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", {
            username: "alice",
            password: "secret",
        });
        await client.discoverCalendars();
        await client.close();

        const authorization = authorizations[1] ?? "";
        const cnonce = /cnonce="([^"]+)"/.exec(authorization)?.[1];
        expect(cnonce).toBeTruthy();
        const hash = (value: string) =>
            createHash("md5").update(value, "utf8").digest("hex");
        const expected = hash(
            `${hash("alice:BaikalDAV:secret")}:server-nonce:00000001:${cnonce}:auth:${hash("PROPFIND:/dav/")}`,
        );
        expect(authorizations[0]).toBeNull();
        expect(authorization).toContain('username="alice"');
        expect(authorization).toContain('uri="/dav/"');
        expect(authorization).toContain(`response="${expected}"`);
        expect(authorization).toContain('opaque="opaque-value"');
        expect(authorizations[2]).toContain('uri="/principals/alice/"');
    });

    it("falls back to Basic when that is the supported challenge", async () => {
        const authorizations: Array<string | null> = [];
        globalThis.fetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
            const authorization = new Headers(init?.headers).get("authorization");
            authorizations.push(authorization);
            if (!authorization) {
                return new Response(null, {
                    status: 401,
                    headers: { "www-authenticate": 'Basic realm="Calendar"' },
                });
            }
            return new Response(discovery, { status: 207 });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", {
            username: "alice",
            password: "secret",
        });
        await expect(client.discoverCalendars()).rejects.toEqual(
            new CalDavFailure("caldav:not-caldav"),
        );
        await client.close();
        expect(authorizations[0]).toBeNull();
        expect(authorizations[1]).toBe(
            `Basic ${Buffer.from("alice:secret", "utf8").toString("base64")}`,
        );
    });

    it("refreshes a stale Digest nonce once", async () => {
        const authorizations: Array<string | null> = [];
        globalThis.fetch = (async (url: URL | RequestInfo, init?: RequestInit) => {
            const authorization = new Headers(init?.headers).get("authorization");
            authorizations.push(authorization);
            if (authorizations.length === 1) {
                return new Response(null, {
                    status: 401,
                    headers: {
                        "www-authenticate":
                            'Digest realm="BaikalDAV", nonce="old", qop="auth"',
                    },
                });
            }
            if (authorizations.length === 2) {
                return new Response(null, {
                    status: 401,
                    headers: {
                        "www-authenticate":
                            'Digest realm="BaikalDAV", nonce="fresh", qop="auth", stale=true',
                    },
                });
            }
            const value = String(url);
            const body = value.includes("principals")
                ? principal
                : value.includes("calendars")
                  ? calendars
                  : discovery;
            return new Response(body, { status: 207 });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", {
            username: "alice",
            password: "secret",
        });
        await client.discoverCalendars();
        await client.close();
        expect(authorizations[1]).toContain('nonce="old"');
        expect(authorizations[2]).toContain('nonce="fresh"');
        expect(authorizations[2]).toContain("nc=00000001");
    });

    it("reports unsupported authentication challenges", async () => {
        globalThis.fetch = (async () =>
            new Response(null, {
                status: 401,
                headers: { "www-authenticate": "Negotiate" },
            })) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", {
            username: "alice",
            password: "secret",
        });
        await expect(client.discoverCalendars()).rejects.toEqual(
            new CalDavFailure("caldav:unsupported-authentication"),
        );
        await client.close();
    });

    it("queries, updates, and deletes resources with ETag guards", async () => {
        const methods: Array<{ method?: string; match: string | null }> = [];
        globalThis.fetch = (async (_url: URL | RequestInfo, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            methods.push({ method: init?.method, match: headers.get("if-match") });
            if (init?.method === "REPORT") {
                return new Response(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/calendars/alice/work/item.ics</d:href><d:propstat><d:prop><d:getetag>&quot;v1&quot;</d:getetag><c:calendar-data>BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:item-1\r\nSUMMARY:Item\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n</c:calendar-data></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`, { status: 207 });
            }
            if (init?.method === "GET") {
                return new Response("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:item-1\r\nSUMMARY:Item\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n", { status: 200 });
            }
            return new Response(null, { status: init?.method === "DELETE" ? 204 : 200, headers: { etag: '"v2"' } });
        }) as typeof fetch;
        const client = new CalDavClient("https://calendar.example/dav/", { username: "alice", password: "secret" });
        const calendar = { id: "https://calendar.example/calendars/alice/work/", type: "calendar" as const, name: "Work", components: ["event" as const] };
        expect(await client.query(calendar, { type: "event" })).toHaveLength(1);
        expect(await client.update(`${calendar.id}item.ics`, '"v1"', "data")).toMatchObject({ etag: '"v2"' });
        await client.delete(`${calendar.id}item.ics`, '"v2"');
        await client.close();
        expect(methods.map((item) => item.method)).toEqual(["REPORT", "GET", "PUT", "DELETE"]);
        expect(methods[2]?.match).toBe('"v1"');
        expect(methods[3]?.match).toBe('"v2"');
    });
});
