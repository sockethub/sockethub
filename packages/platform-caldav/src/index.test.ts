import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
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

    // Regression for the Node 26 half of sockethub/sockethub#1293: a feed read
    // passed our undici Agent to the runtime global fetch. On Node 26 that
    // global is undici 8, and the response comes back with no headers, so a
    // redirect's Location is invisible and the read fails. The real fetch must
    // be undici's, which keeps Location. Bun's runner ignores dispatchers, so
    // this runs under Node against the built package.
    it("follows a redirect through undici fetch on Node", async () => {
        const moduleUrl = pathToFileURL(
            join(import.meta.dir, "../dist/index.js"),
        ).href;
        const script = `
            import { createServer } from "node:http";
            import CalDav from ${JSON.stringify(moduleUrl)};
            const ics = ${JSON.stringify(ics)};
            const server = createServer((req, res) => {
                if (req.url === "/cal.ics") {
                    res.writeHead(302, { location: "/moved.ics" });
                    res.end();
                    return;
                }
                res.setHeader("content-type", "text/calendar");
                res.end(ics);
            });
            await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
            const { port } = server.address();
            const platform = new CalDav({
                log: { error() {}, warn() {}, info() {}, debug() {} },
            });
            platform.config.allowPrivateAddresses = true;
            platform.config.allowInsecureHttp = true;
            try {
                const result = await new Promise((resolve, reject) => {
                    platform.read(
                        {
                            type: "read",
                            actor: { id: "caldav:alice", type: "person" },
                            target: { id: "http://127.0.0.1:" + port + "/cal.ics", type: "feed" },
                        },
                        (error, value) => error ? reject(new Error(String(error))) : resolve(value),
                    );
                });
                const item = result.items?.[0];
                if (!item || item.name !== "A" || !String(item.id).endsWith("/moved.ics#a")) {
                    console.error(JSON.stringify(result));
                    process.exitCode = 1;
                }
            } finally {
                await new Promise((resolve) => platform.cleanup(resolve));
                server.close();
            }
        `;
        const child = Bun.spawn(
            ["node", "--input-type=module", "--eval", script],
            {
                stdout: "pipe",
                stderr: "pipe",
                env: { ...process.env, NODE_NO_WARNINGS: "1" },
            },
        );
        const [exitCode, stdout, stderr] = await Promise.all([
            child.exited,
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
        ]);
        expect(`${stdout}${stderr}`).toBe("");
        expect(exitCode).toBe(0);
    });
});
