/**
 * End-to-end coverage for the media platform: a real server (run under Node,
 * so the guarded dispatcher is in force) and a local image origin. Covers both
 * transports, a refused block page, the platform's concurrency limit, and
 * link previews staying fast while downloads are slow.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { io, type Socket } from "socket.io-client";
import config from "./config.js";

const PORT = 10562;
const base = `http://localhost:${PORT}`;
const context = (platform: string) => [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    `https://sockethub.org/ns/context/platform/${platform}/v1.jsonld`,
];
/** How long the origin takes to answer a slow image, so downloads overlap. */
const ORIGIN_DELAY_MS = 1500;

const PNG = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    Buffer.alloc(64, 1),
]);

let server: ChildProcess;
let origin: Server;
let originUrl: string;
let active = 0;
let maxActive = 0;

function download(url: string, page = `${originUrl}/article`) {
    return {
        "@context": context("media"),
        type: "download",
        actor: { id: page, type: "website" },
        object: { type: "image", url },
    };
}

async function connect(): Promise<Socket> {
    const socket = io(base, { path: "/sockethub", transports: ["websocket"] });
    await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
    return socket;
}

function send(
    socket: Socket,
    msg: unknown,
): Promise<{
    object?: { data?: string; mediaType?: string; title?: string };
    error?: string;
}> {
    return new Promise((resolve) => socket.emit("message", msg, resolve));
}

describe("media platform integration", () => {
    beforeAll(async () => {
        origin = createServer(async (req, res) => {
            const url = new URL(req.url ?? "/", "http://origin");
            if (url.pathname === "/page") {
                res.writeHead(200, { "content-type": "text/html" });
                res.end(
                    "<html><head><meta property='og:title' content='Page'></head></html>",
                );
                return;
            }
            if (url.pathname === "/blocked") {
                res.writeHead(200, { "content-type": "text/html" });
                res.end("<html>captcha</html>");
                return;
            }
            active++;
            maxActive = Math.max(maxActive, active);
            if (url.searchParams.has("slow")) {
                await new Promise((r) => setTimeout(r, ORIGIN_DELAY_MS));
            }
            active--;
            res.writeHead(200, { "content-type": "application/octet-stream" });
            res.end(PNG);
        });
        await new Promise<void>((r) => origin.listen(0, "127.0.0.1", r));
        originUrl = `http://127.0.0.1:${(origin.address() as AddressInfo).port}`;

        server = spawn(
            "node",
            [join(process.cwd(), "packages/sockethub/bin/sockethub")],
            {
                env: {
                    ...process.env,
                    PORT: String(PORT),
                    REDIS_URL: config.redis.url,
                    // Allows the local origin (127.0.0.1).
                    SOCKETHUB_CONFIG: join(
                        process.cwd(),
                        "integration/sockethub.ci.config.json",
                    ),
                    SOCKETHUB_HTTP_ACTIONS_ENABLED: "true",
                },
                stdio: ["ignore", "pipe", "pipe"],
            },
        );
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
                () => reject(new Error("sockethub did not start")),
                20000,
            );
            server.stdout?.on("data", (data) => {
                if (String(data).includes("sockethub listening on")) {
                    clearTimeout(timer);
                    resolve();
                }
            });
            server.on("exit", (code) => {
                clearTimeout(timer);
                reject(new Error(`sockethub exited early (${code})`));
            });
        });
    }, 30000);

    afterAll(async () => {
        server?.kill("SIGINT");
        await new Promise((r) => setTimeout(r, 1500));
        if (server && server.exitCode === null) server.kill("SIGKILL");
        origin?.close();
    });

    it("returns an image's bytes and real type over HTTP actions", async () => {
        const res = await fetch(`${base}/sockethub-http`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-request-id": `image-${Date.now()}`,
            },
            body: JSON.stringify(download("/small.png")),
        });
        expect(res.status).toBe(200);
        const line = JSON.parse((await res.text()).trim().split("\n")[0]);
        expect(line.object.type).toBe("image");
        expect(line.object.mediaType).toBe("image/png");
        expect(line.object.url).toBe(`${originUrl}/small.png`);
        expect(Buffer.from(line.object.data, "base64").equals(PNG)).toBe(true);
    });

    it("returns an image over Socket.IO and refuses a block page", async () => {
        const socket = await connect();
        try {
            const ok = await send(socket, download("/small.png"));
            expect(ok.object?.mediaType).toBe("image/png");
            expect(
                Buffer.from(ok.object?.data ?? "", "base64").equals(PNG),
            ).toBe(true);

            const blocked = await send(socket, download("/blocked"));
            expect(blocked.error).toContain(
                "image download failed (not-image)",
            );
        } finally {
            socket.close();
        }
    });

    it("runs three downloads at once without holding up link previews", async () => {
        maxActive = 0;
        const socket = await connect();
        try {
            const started = Date.now();
            const downloads = Array.from({ length: 6 }, (_, i) =>
                send(socket, download(`/i.png?slow&n=${i}`)),
            );
            await new Promise((r) => setTimeout(r, 100));
            const previews = await Promise.all(
                Array.from({ length: 3 }, async () => {
                    const result = await send(socket, {
                        "@context": context("metadata"),
                        type: "fetch",
                        actor: { id: `${originUrl}/page`, type: "website" },
                    });
                    return { ms: Date.now() - started, result };
                }),
            );
            const results = await Promise.all(downloads);

            expect(results.filter((r) => r.object?.data).length).toBe(6);
            expect(maxActive).toBe(3);
            // Every preview finished before the first round of downloads did.
            for (const preview of previews) {
                expect(preview.result.object?.title).toBe("Page");
                expect(preview.ms).toBeLessThan(ORIGIN_DELAY_MS);
            }
        } finally {
            socket.close();
        }
    }, 30000);
});
