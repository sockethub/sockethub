import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { validateServiceDescriptor } from "@sockethub/schemas";
import express from "express";

import type { PlatformMap } from "./bootstrap/load-platforms.js";
import {
    buildServerInfo,
    escapeHtml,
    EXAMPLES_PATH,
    formatUptime,
    publicSocketUrl,
    registerServerInfoRoute,
    renderServerInfoPage,
} from "./server-info.js";
import { SOCKETHUB_API_VERSION, SOCKETHUB_VERSION } from "./version.js";

const platforms: PlatformMap = new Map([
    [
        "dummy",
        {
            id: "dummy",
            moduleName: "@sockethub/platform-dummy",
            config: { persist: false },
            schemas: { name: "dummy", version: "3.0.0", messages: {} },
            version: "3.0.0-alpha.25",
            apiVersion: 3,
            contextUrl: "https://sockethub.org/ns/v/context/platform/dummy",
            contextVersion: "1",
            schemaVersion: "1",
            types: ["echo"],
        },
    ],
    [
        "irc",
        {
            id: "irc",
            moduleName: "@sockethub/platform-irc",
            config: { persist: true },
            schemas: { name: "irc", version: "4.0.0", messages: {} },
            version: "4.0.0-alpha.25",
            apiVersion: 4,
            contextUrl: "https://sockethub.org/ns/v/context/platform/irc",
            contextVersion: "1",
            schemaVersion: "1",
            types: ["connect", "send"],
        },
    ],
] as Array<[string, PlatformMap extends Map<string, infer V> ? V : never]>);

const defaults: Record<string, unknown> = {
    "public:protocol": "http",
    "public:host": "localhost",
    "public:port": 10550,
    "sockethub:path": "/sockethub",
    "httpActions:enabled": false,
    "httpActions:path": "/sockethub-http",
    examples: false,
    "about:name": "",
    "about:description": "",
    "about:contact": "",
    "about:links": [],
    "about:showVersion": false,
};

function getConfigWith(overrides: Record<string, unknown> = {}) {
    const values = { ...defaults, ...overrides };
    return (key: string) => values[key];
}

describe("server-info", () => {
    describe("publicSocketUrl", () => {
        it("includes a non-default port", () => {
            expect(publicSocketUrl(getConfigWith())).toBe(
                "http://localhost:10550/sockethub",
            );
        });

        it("omits the protocol default port", () => {
            expect(
                publicSocketUrl(
                    getConfigWith({
                        "public:protocol": "https",
                        "public:host": "sockethub.example.com",
                        "public:port": 443,
                    }),
                ),
            ).toBe("https://sockethub.example.com/sockethub");
        });
    });

    describe("buildServerInfo", () => {
        it("omits empty operator fields and the version by default", () => {
            const info = buildServerInfo(platforms, {
                getConfig: getConfigWith(),
            });
            expect(info.name).toBeUndefined();
            expect(info.description).toBeUndefined();
            expect(info.contact).toBeUndefined();
            expect(info.links).toEqual([]);
            expect(info.version).toBeUndefined();
            expect(info.uptimeSeconds).toBeUndefined();
            expect(info.apiVersion).toBe(SOCKETHUB_API_VERSION);
            expect(info.platforms).toEqual([
                { id: "dummy", apiVersion: 3 },
                { id: "irc", apiVersion: 4 },
            ]);
            expect(info.endpoints).toEqual({
                socket: "http://localhost:10550/sockethub",
            });
        });

        it("includes operator fields, version and uptime when configured", () => {
            const info = buildServerInfo(platforms, {
                getConfig: getConfigWith({
                    "about:name": "  Kosmos  ",
                    "about:description": "Members only",
                    "about:contact": "ops@example.org",
                    "about:links": [
                        { label: "Privacy", url: "https://example.org/p" },
                    ],
                    "about:showVersion": true,
                }),
                uptimeSeconds: () => 90061.7,
            });
            expect(info.name).toBe("Kosmos");
            expect(info.description).toBe("Members only");
            expect(info.contact).toBe("ops@example.org");
            expect(info.links).toEqual([
                { label: "Privacy", url: "https://example.org/p" },
            ]);
            expect(info.version).toBe(SOCKETHUB_VERSION);
            expect(info.uptimeSeconds).toBe(90061);
        });

        it("drops links that are not http(s) or are malformed", () => {
            const info = buildServerInfo(platforms, {
                getConfig: getConfigWith({
                    "about:links": [
                        { label: "Bad", url: "javascript:alert(1)" },
                        { label: "", url: "https://example.org" },
                        { label: "NoUrl" },
                        null,
                        { label: "Good", url: "HTTPS://example.org/ok" },
                    ],
                }),
            });
            expect(info.links).toEqual([
                { label: "Good", url: "HTTPS://example.org/ok" },
            ]);
        });

        it("advertises HTTP actions and examples only when enabled", () => {
            const off = buildServerInfo(platforms, {
                getConfig: getConfigWith(),
            });
            expect(off.endpoints.httpActions).toBeUndefined();
            expect(off.endpoints.examples).toBeUndefined();

            const on = buildServerInfo(platforms, {
                getConfig: getConfigWith({
                    "httpActions:enabled": true,
                    "httpActions:path": "/custom-http",
                    examples: true,
                }),
            });
            expect(on.endpoints.httpActions).toBe(
                "http://localhost:10550/custom-http",
            );
            expect(on.endpoints.examples).toBe(EXAMPLES_PATH);
        });
    });

    describe("escapeHtml", () => {
        it("escapes every HTML-significant character", () => {
            expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
                "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
            );
        });
    });

    describe("formatUptime", () => {
        it("formats seconds as a human duration", () => {
            expect(formatUptime(30)).toBe("less than a minute");
            expect(formatUptime(60)).toBe("1 minute");
            expect(formatUptime(3600 + 120)).toBe("1 hour, 2 minutes");
            expect(formatUptime(2 * 86400 + 5 * 3600 + 59 * 60)).toBe(
                "2 days, 5 hours",
            );
            expect(formatUptime(-5)).toBe("less than a minute");
        });
    });

    describe("renderServerInfoPage", () => {
        it("escapes operator-supplied text", () => {
            const html = renderServerInfoPage(
                buildServerInfo(platforms, {
                    getConfig: getConfigWith({
                        "about:name": "<script>alert(1)</script>",
                        "about:description": 'a "quoted" & <b>bold</b>',
                        "about:contact": "https://example.org/<x>",
                        "about:links": [
                            {
                                label: "<i>Privacy</i>",
                                url: "https://example.org/?a=1&b=2",
                            },
                        ],
                    }),
                }),
            );
            expect(html).not.toContain("<script>alert(1)</script>");
            expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
            expect(html).toContain("a &quot;quoted&quot; &amp; &lt;b&gt;bold&lt;/b&gt;");
            expect(html).not.toContain("<i>Privacy</i>");
            expect(html).toContain("&lt;i&gt;Privacy&lt;/i&gt;");
            expect(html).toContain('href="https://example.org/?a=1&amp;b=2"');
            expect(html).toContain('href="https://example.org/&lt;x&gt;"');
        });

        it("omits the server section and version rows by default", () => {
            const html = renderServerInfoPage(
                buildServerInfo(platforms, { getConfig: getConfigWith() }),
            );
            expect(html).not.toContain("<caption>Server</caption>");
            expect(html).toContain('<span class="sr-only">Sockethub</span>');
            expect(html).toContain("<svg ");
            expect(html).toContain('href="/favicon.ico"');
            expect(html).not.toContain("Version</th>");
            expect(html).not.toContain("Uptime</th>");
            expect(html).not.toContain(SOCKETHUB_VERSION);
            expect(html).not.toContain("open the examples");
            expect(html).not.toContain("HTTP actions</th>");
            expect(html).toContain(`API version</th><td>${SOCKETHUB_API_VERSION}</td>`);
            expect(html).toContain("<code>http://localhost:10550/sockethub</code>");
            expect(html).toContain("dummy <small>v3</small>");
            expect(html).toContain("irc <small>v4</small>");
            expect(html).toContain("<caption>Connect</caption>");
            expect(html).toContain("<caption>Server Software</caption>");
        });

        it("links the examples and shows version when enabled", () => {
            const html = renderServerInfoPage(
                buildServerInfo(platforms, {
                    getConfig: getConfigWith({
                        examples: true,
                        "httpActions:enabled": true,
                        "about:showVersion": true,
                        "about:contact": "ops@example.org",
                    }),
                    uptimeSeconds: () => 7200,
                }),
            );
            expect(html).toContain(`href="${EXAMPLES_PATH}"`);
            expect(html).toContain(
                "<code>http://localhost:10550/sockethub-http</code>",
            );
            expect(html).toContain(`Version</th><td>${SOCKETHUB_VERSION}</td>`);
            expect(html).toContain("Uptime</th><td>2 hours</td>");
            expect(html).toContain('href="mailto:ops@example.org"');
        });

        it("renders a placeholder when no platforms are loaded", () => {
            const html = renderServerInfoPage(
                buildServerInfo(new Map(), { getConfig: getConfigWith() }),
            );
            expect(html).toContain("<span>none enabled</span>");
        });
    });

    describe("registerServerInfoRoute", () => {
        let server: Server;
        let baseUrl: string;

        beforeEach(async () => {
            const app = express();
            registerServerInfoRoute(
                app,
                { platforms },
                { getConfig: getConfigWith({ "about:name": "Test Box" }) },
            );
            server = await new Promise<Server>((resolve) => {
                const s = app.listen(0, "127.0.0.1", () => resolve(s));
            });
            const { port } = server.address() as AddressInfo;
            baseUrl = `http://127.0.0.1:${port}`;
        });

        afterEach(async () => {
            await new Promise<void>((resolve, reject) =>
                server.close((err) => (err ? reject(err) : resolve())),
            );
        });

        it("serves HTML to browsers with no-store caching", async () => {
            const res = await fetch(`${baseUrl}/`, {
                headers: { accept: "text/html,*/*;q=0.8" },
            });
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toContain("text/html");
            expect(res.headers.get("cache-control")).toBe("no-store");
            const body = await res.text();
            expect(body).toContain("<title>Test Box · Sockethub</title>");
        });

        it("serves HTML to clients with no preference, like curl", async () => {
            const res = await fetch(`${baseUrl}/`, {
                headers: { accept: "*/*" },
            });
            expect(res.headers.get("content-type")).toContain("text/html");
        });

        it("serves the service descriptor when JSON is requested", async () => {
            const res = await fetch(`${baseUrl}/`, {
                headers: { accept: "application/json" },
            });
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toContain(
                "application/json",
            );
            expect(res.headers.get("cache-control")).toBe("no-store");
            const body = await res.json();
            expect(validateServiceDescriptor(body)).toBeTrue();
            expect(body).toEqual({
                name: "sockethub",
                apiVersion: SOCKETHUB_API_VERSION,
                platforms: [
                    { id: "dummy", apiVersion: 3 },
                    { id: "irc", apiVersion: 4 },
                ],
            });
            expect(JSON.stringify(body)).not.toContain(SOCKETHUB_VERSION);
        });

        it("leaves other paths unhandled", async () => {
            const res = await fetch(`${baseUrl}/nope`);
            expect(res.status).toBe(404);
        });
    });
});
