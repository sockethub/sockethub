import { describe, expect, it } from "bun:test";
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
    const session = {
        log: { error() {}, warn() {}, info() {}, debug() {} },
    } as unknown as PlatformSession;
    const ics =
        "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART:20260101T100000Z\r\nSUMMARY:A\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

    type FeedFetch = (
        url: URL,
        init: RequestInit & { dispatcher?: unknown },
    ) => Promise<Response>;

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
        const fetchImpl: FeedFetch = async (url, init) => {
            requests.push(String(url));
            expect(init.headers).toMatchObject({
                accept: "text/calendar, */*;q=0.1",
            });
            expect(
                (init.headers as Record<string, string>).authorization,
            ).toBeUndefined();
            return new Response(ics, {
                status: 200,
                headers: { "content-type": "text/calendar" },
            });
        };
        const [error, result] = await read(
            new CalDav(session, fetchImpl),
            "webcal://example.test/cal.ics",
        );
        expect(error).toBeNull();
        expect(requests).toEqual(["https://example.test/cal.ics"]);
        expect(result).toMatchObject({
            type: "collection",
            summary: "iCalendar feed",
            totalItems: 1,
            items: [
                {
                    id: "https://example.test/cal.ics#a",
                    name: "A",
                    updateSupported: false,
                },
            ],
        });
    });

    it("refuses plain HTTP unless the server allows it", async () => {
        const fetchImpl: FeedFetch = async () =>
            new Response(ics, { status: 200 });
        const platform = new CalDav(session, fetchImpl);
        expect((await read(platform, "http://example.test/cal.ics"))[0]).toBe(
            "caldav:https-required",
        );
        expect((await read(platform, "ftp://example.test/cal.ics"))[0]).toBe(
            "caldav:invalid-feed",
        );
        platform.config.allowInsecureHttp = true;
        expect((await read(platform, "http://example.test/cal.ics"))[0]).toBeNull();
    });

    it("re-checks the scheme policy on every redirect hop", async () => {
        const requests: string[] = [];
        const redirectTo =
            (location: string): FeedFetch =>
            async (url, init) => {
                requests.push(String(url));
                expect(init.redirect).toBe("manual");
                return requests.length === 1
                    ? new Response(null, { status: 302, headers: { location } })
                    : new Response(ics, { status: 200 });
            };
        expect(
            (
                await read(
                    new CalDav(session, redirectTo("http://example.test/moved.ics")),
                    "https://example.test/cal.ics",
                )
            )[0],
        ).toBe("caldav:https-required");
        expect(requests).toEqual(["https://example.test/cal.ics"]);
        requests.length = 0;
        const [error, result] = await read(
            new CalDav(session, redirectTo("/moved.ics")),
            "https://example.test/cal.ics",
        );
        expect(error).toBeNull();
        expect(requests).toEqual([
            "https://example.test/cal.ics",
            "https://example.test/moved.ics",
        ]);
        expect(result).toMatchObject({
            items: [{ id: "https://example.test/moved.ics#a" }],
        });
        const loop: FeedFetch = async () =>
            new Response(null, {
                status: 302,
                headers: { location: "https://example.test/loop.ics" },
            });
        expect(
            (
                await read(
                    new CalDav(session, loop),
                    "https://example.test/cal.ics",
                )
            )[0],
        ).toBe("caldav:too-many-redirects");
    });

    it("reports failed requests and non-calendar bodies", async () => {
        const missing: FeedFetch = async () =>
            new Response("missing", { status: 404 });
        expect(
            (
                await read(
                    new CalDav(session, missing),
                    "https://example.test/cal.ics",
                )
            )[0],
        ).toBe("caldav:feed-failed");
        const html: FeedFetch = async () =>
            new Response("<html></html>", { status: 200 });
        expect(
            (
                await read(
                    new CalDav(session, html),
                    "https://example.test/cal.ics",
                )
            )[0],
        ).toBe("caldav:invalid-response");
    });

    // Node-runtime redirect + undici fetch regression: integration/dav-node.integration.mjs
    // (Node 22/24/26 matrix in .github/workflows/integration.yml).
});
