/**
 * End-to-end coverage for Web Push: a real server (run under Node, so the
 * guarded dispatcher is in force), a real Redis, and a local stand-in for a
 * browser vendor's push service. Covers both transports, the answers a push
 * service gives, and scheduled delivery with no client connected, including
 * across a server restart.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io, type Socket } from "socket.io-client";
import config from "./config.js";

const PORT = 10563;
const base = `http://localhost:${PORT}`;
const context = [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/webpush/v1.jsonld",
];
const actor = { id: "https://app.example", type: "website" };
/** The scheduler polls every five seconds. */
const DELIVERY_WAIT_MS = 15000;

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
const vapid = {
    publicKey: Buffer.concat([
        Buffer.from([4]),
        Buffer.from(String(jwk.x), "base64url"),
        Buffer.from(String(jwk.y), "base64url"),
    ]).toString("base64url"),
    privateKey: String(jwk.d),
    subject: "mailto:ops@example.org",
};

type Push = {
    path: string;
    headers: Record<string, string | Array<string> | undefined>;
    body: Buffer;
};

let server: ChildProcess | undefined;
let pushService: Server;
let pushUrl: string;
let configDir: string;
const received: Array<Push> = [];

/** A fresh subscription on the stand-in push service. */
let subscriptions = 0;
const subscription = (kind = "ok") =>
    `${pushUrl}/${kind}/${Date.now()}-${++subscriptions}`;

const content = (label: string) =>
    Buffer.from(`ciphertext:${label}`).toString("base64url");

function writeConfig(name: string, scheduling: boolean): string {
    const file = join(configDir, name);
    writeFileSync(
        file,
        JSON.stringify({
            platforms: ["@sockethub/platform-webpush"],
            examples: false,
            packageConfig: {
                "@sockethub/platform-webpush": {
                    vapid,
                    // The stand-in push service, reached over loopback http.
                    allowedHosts: ["127.0.0.1"],
                    allowPrivateAddresses: true,
                    allowInsecureHttp: true,
                },
            },
            scheduledDelivery: {
                secret: scheduling
                    ? "webpush-integration-secret-0123456789"
                    : "",
            },
        }),
    );
    return file;
}

async function startServer(configFile: string): Promise<void> {
    const child = spawn(
        "node",
        [join(process.cwd(), "packages/sockethub/bin/sockethub")],
        {
            env: {
                ...process.env,
                PORT: String(PORT),
                REDIS_URL: config.redis.url,
                SOCKETHUB_CONFIG: configFile,
                SOCKETHUB_HTTP_ACTIONS_ENABLED: "true",
            },
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    server = child;
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error("sockethub did not start")),
            20000,
        );
        child.stdout?.on("data", (data) => {
            if (String(data).includes("sockethub listening on")) {
                clearTimeout(timer);
                resolve();
            }
        });
        child.on("exit", (code) => {
            clearTimeout(timer);
            reject(new Error(`sockethub exited early (${code})`));
        });
    });
}

async function stopServer(): Promise<void> {
    const child = server;
    server = undefined;
    if (!child || child.exitCode !== null) return;
    // Drop the "exited early" listener from startServer first.
    child.removeAllListeners("exit");
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGINT");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timer);
}

async function httpAction(msg: unknown) {
    const res = await fetch(`${base}/sockethub-http`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-request-id": `webpush-${Date.now()}-${++subscriptions}`,
        },
        body: JSON.stringify(msg),
    });
    expect(res.status).toBe(200);
    return JSON.parse((await res.text()).trim().split("\n")[0]);
}

async function connect(): Promise<Socket> {
    const socket = io(base, { path: "/sockethub", transports: ["websocket"] });
    await new Promise<void>((resolve) => socket.on("connect", () => resolve()));
    return socket;
}

function socketAction(
    socket: Socket,
    msg: unknown,
): Promise<{
    object?: { status?: string; pending?: number; detail?: string };
    target?: unknown;
    error?: string;
}> {
    return new Promise((resolve) => socket.emit("message", msg, resolve));
}

const send = (target: string, label: string, extra = {}) => ({
    "@context": context,
    type: "send",
    actor,
    target: { id: target, type: "service" },
    object: { type: "push", content: content(label), ...extra },
});

const schedule = (
    target: string,
    items: Array<{ inMs: number; label: string; ttl?: number }>,
) => ({
    "@context": context,
    type: "schedule",
    actor,
    target: { id: target, type: "service" },
    object: {
        type: "schedule",
        items: items.map(({ inMs, label, ttl }) => ({
            deliverAt: new Date(Date.now() + inMs).toISOString(),
            content: content(label),
            ...(ttl === undefined ? {} : { ttl }),
        })),
    },
});

/** Resolves with the push sent to `target`, or undefined after `timeoutMs`. */
async function delivered(
    target: string,
    timeoutMs = DELIVERY_WAIT_MS,
): Promise<Push | undefined> {
    const path = new URL(target).pathname;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const push = received.find((p) => p.path === path);
        if (push) return push;
        await new Promise((r) => setTimeout(r, 100));
    }
    return undefined;
}

describe("webpush platform integration", () => {
    beforeAll(async () => {
        pushService = createServer((req, res) => {
            const chunks: Array<Buffer> = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => {
                const path = req.url ?? "/";
                received.push({
                    path,
                    headers: req.headers,
                    body: Buffer.concat(chunks),
                });
                if (path.startsWith("/gone/")) {
                    res.writeHead(410).end();
                } else if (path.startsWith("/busy/")) {
                    res.writeHead(429, { "retry-after": "90" }).end();
                } else if (path.startsWith("/refused/")) {
                    res.writeHead(403).end('{"reason":"BadJwtToken"}');
                } else {
                    res.writeHead(201).end();
                }
            });
        });
        await new Promise<void>((r) => pushService.listen(0, "127.0.0.1", r));
        pushUrl = `http://127.0.0.1:${(pushService.address() as AddressInfo).port}`;

        configDir = mkdtempSync(join(tmpdir(), "sockethub-webpush-"));
        await startServer(writeConfig("scheduling.json", true));
    }, 30000);

    afterAll(async () => {
        await stopServer();
        pushService?.close();
        rmSync(configDir, { recursive: true, force: true });
    });

    it("publishes the public key apps subscribe with", async () => {
        const res = await fetch(`${base}/`, {
            headers: { accept: "application/json" },
        });
        const descriptor = await res.json();
        expect(descriptor.webpush).toEqual({
            publicKey: vapid.publicKey,
            scheduling: true,
        });
        expect(JSON.stringify(descriptor)).not.toContain(vapid.privateKey);
    });

    it("sends over HTTP actions with a token the push service can verify", async () => {
        const target = subscription();
        const result = await httpAction(
            send(target, "http", { ttl: 600, urgency: "high", topic: "daily" }),
        );

        expect(result.object).toEqual({
            type: "delivery",
            status: "accepted",
            httpStatus: 201,
        });
        // Results can be cached for replay; the delivery URL must not be.
        expect(JSON.stringify(result)).not.toContain(new URL(target).pathname);

        const push = await delivered(target, 1000);
        expect(push?.body.toString()).toBe("ciphertext:http");
        expect(push?.headers.ttl).toBe("600");
        expect(push?.headers.urgency).toBe("high");
        expect(push?.headers.topic).toBe("daily");
        expect(push?.headers["content-encoding"]).toBe("aes128gcm");

        const match = /^vapid t=([^,]+), k=(.+)$/.exec(
            String(push?.headers.authorization),
        );
        expect(match?.[2]).toBe(vapid.publicKey);
        const [head, claims, signature] = String(match?.[1]).split(".");
        expect(
            verify(
                "sha256",
                Buffer.from(`${head}.${claims}`),
                {
                    key: createPublicKey({
                        format: "jwk",
                        key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y },
                    }),
                    dsaEncoding: "ieee-p1363",
                },
                Buffer.from(signature, "base64url"),
            ),
        ).toBe(true);
        const parsed = JSON.parse(Buffer.from(claims, "base64url").toString());
        expect(parsed.aud).toBe(pushUrl);
        expect(parsed.sub).toBe(vapid.subject);
        expect(parsed.exp).toBeGreaterThan(Date.now() / 1000);
        expect(parsed.exp).toBeLessThanOrEqual(Date.now() / 1000 + 24 * 3600);
    });

    it("reports each push service answer over Socket.IO", async () => {
        const socket = await connect();
        try {
            const gone = await socketAction(
                socket,
                send(subscription("gone"), "a"),
            );
            expect(gone.object).toEqual({
                type: "delivery",
                status: "gone",
                httpStatus: 410,
            });
            expect(gone.error).toBeUndefined();
            expect(gone.target).toBeUndefined();

            const busy = await socketAction(
                socket,
                send(subscription("busy"), "b"),
            );
            expect(busy.object).toEqual({
                type: "delivery",
                status: "retry",
                httpStatus: 429,
                retryAfter: 90,
            });

            const refused = await socketAction(
                socket,
                send(subscription("refused"), "c"),
            );
            expect(refused.object).toEqual({
                type: "delivery",
                status: "rejected",
                httpStatus: 403,
                detail: '{"reason":"BadJwtToken"}',
            });
        } finally {
            socket.close();
        }
    });

    it("does not post to a host that is not an allowed push service", async () => {
        const before = received.length;
        const result = await httpAction(
            send(`http://localhost:${new URL(pushUrl).port}/ok/elsewhere`, "x"),
        );
        expect(result.object.status).toBe("rejected");
        expect(received.length).toBe(before);
    });

    it("delivers a scheduled message with no client connected", async () => {
        const target = subscription();
        const ack = await httpAction(
            schedule(target, [{ inMs: 1000, label: "reminder", ttl: 600 }]),
        );
        expect(ack.object).toEqual({ type: "schedule", pending: 1 });
        expect(JSON.stringify(ack)).not.toContain(new URL(target).pathname);
        expect(received.some((p) => p.path === new URL(target).pathname)).toBe(
            false,
        );

        const push = await delivered(target);
        expect(push?.body.toString()).toBe("ciphertext:reminder");
        // The push service is given no more than what is left of the ttl.
        expect(Number(push?.headers.ttl)).toBeLessThanOrEqual(600);
        expect(Number(push?.headers.ttl)).toBeGreaterThan(570);
    }, 30000);

    it("replaces a schedule, and an empty one cancels it", async () => {
        const replaced = subscription();
        const cancelled = subscription();
        const socket = await connect();
        try {
            await socketAction(
                socket,
                schedule(replaced, [{ inMs: 1000, label: "old" }]),
            );
            const second = await socketAction(
                socket,
                schedule(replaced, [{ inMs: 1500, label: "new" }]),
            );
            expect(second.object).toEqual({ type: "schedule", pending: 1 });
            await socketAction(
                socket,
                schedule(cancelled, [{ inMs: 1000, label: "never" }]),
            );
            const cancel = await socketAction(socket, schedule(cancelled, []));
            expect(cancel.object).toEqual({ type: "schedule", pending: 0 });
        } finally {
            socket.close();
        }

        expect((await delivered(replaced))?.body.toString()).toBe(
            "ciphertext:new",
        );
        // One more poll, so a wrongly kept message would have gone out too.
        await new Promise((r) => setTimeout(r, 6000));
        const path = (target: string) => new URL(target).pathname;
        expect(received.filter((p) => p.path === path(replaced))).toHaveLength(
            1,
        );
        expect(received.some((p) => p.path === path(cancelled))).toBe(false);
    }, 40000);

    it("stops sending to a subscription the push service says is gone", async () => {
        const target = subscription("gone");
        await httpAction(
            schedule(target, [
                { inMs: 500, label: "first" },
                { inMs: 7000, label: "second" },
            ]),
        );
        expect((await delivered(target))?.body.toString()).toBe(
            "ciphertext:first",
        );
        // Past the second message's time and one more poll.
        await new Promise((r) => setTimeout(r, 13000));
        expect(
            received.filter((p) => p.path === new URL(target).pathname),
        ).toHaveLength(1);
    }, 40000);

    it("delivers a message scheduled before a restart", async () => {
        const target = subscription();
        const ack = await httpAction(
            schedule(target, [{ inMs: 4000, label: "after-restart" }]),
        );
        expect(ack.object.pending).toBe(1);

        // A new process: new boot id, new per-boot secrets, nothing in
        // memory. Only Redis and the configured secret carry over.
        await stopServer();
        expect(received.some((p) => p.path === new URL(target).pathname)).toBe(
            false,
        );
        await startServer(join(configDir, "scheduling.json"));

        expect((await delivered(target, 20000))?.body.toString()).toBe(
            "ciphertext:after-restart",
        );
    }, 60000);

    it("refuses schedule when no secret is configured, and still sends", async () => {
        await stopServer();
        await startServer(writeConfig("no-scheduling.json", false));

        const descriptor = await (
            await fetch(`${base}/`, { headers: { accept: "application/json" } })
        ).json();
        expect(descriptor.webpush.scheduling).toBe(false);

        const target = subscription();
        const refused = await httpAction(
            schedule(target, [{ inMs: 500, label: "x" }]),
        );
        expect(refused.error).toContain("scheduled delivery is not enabled");

        const sent = await httpAction(send(target, "direct"));
        expect(sent.object.status).toBe("accepted");
    }, 60000);
});
