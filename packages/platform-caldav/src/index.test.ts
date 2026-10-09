import { afterEach, describe, expect, it } from "bun:test";
import type { PlatformSession } from "@sockethub/schemas";
import { CalDavFailure } from "./dav.js";
import CalDav, { assertCalendarResource } from "./index.js";

describe("CalDAV resource membership", () => {
    const calendar = "https://calendar.example/dav/alice/work/";

    it("accepts a direct child item", () => {
        expect(() =>
            assertCalendarResource(calendar, `${calendar}item.ics`),
        ).not.toThrow();
    });

    it("rejects collection targets and encoded traversal", () => {
        for (const resource of [
            calendar,
            `${calendar}?delete=true`,
            "https://evil.example/dav/alice/work/item.ics",
            "https://calendar.example/dav/alice/work-other/item.ics",
            `${calendar}item.ics#fragment`,
            `${calendar}..%2f..%2ffiles/item`,
            `${calendar}%2e%2e%2f%2e%2e%2ffiles/item`,
            `${calendar}%252e%252e%252ffiles/item`,
        ]) {
            expect(() => assertCalendarResource(calendar, resource)).toThrow(
                new CalDavFailure("caldav:invalid-resource"),
            );
        }
    });
});

describe("CalDAV read", () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => {
        globalThis.fetch = originalFetch;
    });
    const session = {
        log: { error() {}, warn() {}, info() {}, debug() {} },
    } as unknown as PlatformSession;
    const ics =
        "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART:20260101T100000Z\r\nSUMMARY:A\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

    function read(platform: CalDav, target: string, object?: object) {
        return new Promise<[unknown, unknown]>((resolve) => {
            platform.read(
                {
                    type: "read",
                    actor: { id: "caldav:alice", type: "person" },
                    target: { id: target, type: "feed" },
                    ...(object ? { object } : {}),
                } as never,
                (error, result) => resolve([error, result]),
            );
        });
    }

    it("fetches a webcal link over HTTPS without credentials", async () => {
        const requests: string[] = [];
        globalThis.fetch = (async (url: URL | RequestInfo, init?: RequestInit) => {
            requests.push(String(url));
            expect(init?.headers).toMatchObject({ accept: "text/calendar, */*;q=0.1" });
            expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
            return new Response(ics, { status: 200, headers: { "content-type": "text/calendar" } });
        }) as typeof fetch;
        const [error, result] = await read(new CalDav(session), "webcal://example.test/cal.ics");
        expect(error).toBeNull();
        expect(requests).toEqual(["https://example.test/cal.ics"]);
        expect(result).toMatchObject({
            type: "collection",
            summary: "iCalendar feed",
            totalItems: 1,
            items: [{ id: "https://example.test/cal.ics#a", name: "A", updateSupported: false }],
        });
    });

    it("refuses plain HTTP unless the server allows it", async () => {
        globalThis.fetch = (async () => new Response(ics, { status: 200 })) as typeof fetch;
        const platform = new CalDav(session);
        expect((await read(platform, "http://example.test/cal.ics"))[0]).toBe("caldav:https-required");
        expect((await read(platform, "ftp://example.test/cal.ics"))[0]).toBe("caldav:invalid-feed");
        platform.config.allowInsecureHttp = true;
        expect((await read(platform, "http://example.test/cal.ics"))[0]).toBeNull();
    });

    it("follows an HTTPS redirect and refuses a downgrade to HTTP", async () => {
        const requests: string[] = [];
        globalThis.fetch = (async (url: URL | RequestInfo, init?: RequestInit) => {
            requests.push(String(url));
            expect(init?.redirect).toBe("manual");
            if (String(url) === "https://example.test/start.ics") {
                return new Response(null, {
                    status: 302,
                    headers: { location: "http://example.test/cal.ics" },
                });
            }
            return new Response(ics, { status: 200 });
        }) as typeof fetch;
        const platform = new CalDav(session);
        expect((await read(platform, "https://example.test/start.ics"))[0]).toBe("caldav:https-required");
        expect(requests).toEqual(["https://example.test/start.ics"]);

        requests.length = 0;
        globalThis.fetch = (async (url: URL | RequestInfo) => {
            requests.push(String(url));
            if (String(url) === "https://example.test/start.ics") {
                return new Response(null, {
                    status: 302,
                    headers: { location: "https://cdn.example.test/cal.ics" },
                });
            }
            return new Response(ics, { status: 200, headers: { "content-type": "text/calendar" } });
        }) as typeof fetch;
        const [error, result] = await read(platform, "https://example.test/start.ics");
        expect(error).toBeNull();
        expect(requests).toEqual([
            "https://example.test/start.ics",
            "https://cdn.example.test/cal.ics",
        ]);
        expect(result).toMatchObject({
            items: [{ id: "https://cdn.example.test/cal.ics#a" }],
        });

        platform.config.allowInsecureHttp = true;
        requests.length = 0;
        globalThis.fetch = (async (url: URL | RequestInfo) => {
            requests.push(String(url));
            if (requests.length === 1) {
                return new Response(null, {
                    status: 302,
                    headers: { location: "http://example.test/cal.ics" },
                });
            }
            return new Response(ics, { status: 200, headers: { "content-type": "text/calendar" } });
        }) as typeof fetch;
        expect((await read(platform, "https://example.test/start.ics"))[0]).toBeNull();
        expect(requests).toEqual([
            "https://example.test/start.ics",
            "http://example.test/cal.ics",
        ]);
    });

    it("stops following redirect loops", async () => {
        let requests = 0;
        globalThis.fetch = (async () => {
            requests += 1;
            return new Response(null, {
                status: 302,
                headers: { location: "https://example.test/again.ics" },
            });
        }) as typeof fetch;
        expect((await read(new CalDav(session), "https://example.test/cal.ics"))[0]).toBe("caldav:feed-failed");
        expect(requests).toBe(6);
    });

    it("reports failed requests and non-calendar bodies", async () => {
        globalThis.fetch = (async () => new Response("missing", { status: 404 })) as typeof fetch;
        expect((await read(new CalDav(session), "https://example.test/cal.ics"))[0]).toBe("caldav:feed-failed");
        globalThis.fetch = (async () => new Response("<html></html>", { status: 200 })) as typeof fetch;
        expect((await read(new CalDav(session), "https://example.test/cal.ics"))[0]).toBe("caldav:invalid-response");
    });
});
