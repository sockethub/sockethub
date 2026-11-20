import { describe, expect, it, mock } from "bun:test";
import type {
    ActivityStream,
    PlatformConfig,
    PlatformSession,
} from "@sockethub/schemas";
import WebPush, { hostAllowed, retryAfterSeconds, statusFor } from "./index";
import { generateVapidKeys } from "./vapid.test";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/secret-subscription-id";
const CONTENT = Buffer.alloc(120, 7);
const session: PlatformSession = {
    log: { debug: mock(), info: mock(), warn: mock(), error: mock() },
    sendToClient: mock(),
    updateActor: async () => {},
} as unknown as PlatformSession;

type Call = { url: string; init: RequestInit & { redirect?: string } };

function platform(
    answer: () => Response | Promise<Response>,
    config: Record<string, unknown> = {},
) {
    const calls: Array<Call> = [];
    const webpush = new WebPush(session);
    webpush.config = {
        ...webpush.config,
        vapid: { ...generateVapidKeys(), subject: "mailto:ops@example.org" },
        ...config,
    } as PlatformConfig;
    Object.assign(webpush, {
        fetchImpl: async (url: string, init: Call["init"]) => {
            calls.push({ url, init });
            return answer();
        },
    });
    return { webpush, calls };
}

const job = (overrides: Partial<ActivityStream> = {}): ActivityStream =>
    ({
        type: "send",
        id: "msg-1",
        actor: { id: "https://app.example", type: "website" },
        target: { id: ENDPOINT, type: "service" },
        object: {
            type: "push",
            content: CONTENT.toString("base64url"),
            ttl: 3600,
            urgency: "high",
            topic: "daily",
        },
        ...overrides,
    }) as ActivityStream;

function send(webpush: WebPush, msg: ActivityStream) {
    return new Promise<{ err?: unknown; result?: ActivityStream }>((resolve) =>
        webpush.send(msg, (err, result) =>
            resolve({ err, result: result as ActivityStream }),
        ),
    );
}

describe("webpush send", () => {
    it("posts the ciphertext to the subscription with a signed token", async () => {
        const { webpush, calls } = platform(
            () => new Response(null, { status: 201 }),
        );
        const { err, result } = await send(webpush, job());

        expect(err).toBeNull();
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe(ENDPOINT);
        expect(calls[0].init.method).toBe("POST");
        expect(calls[0].init.redirect).toBe("manual");
        expect(Buffer.from(calls[0].init.body as Buffer).equals(CONTENT)).toBe(
            true,
        );
        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers.authorization).toStartWith("vapid t=");
        expect(headers["content-encoding"]).toBe("aes128gcm");
        expect(headers.ttl).toBe("3600");
        expect(headers.urgency).toBe("high");
        expect(headers.topic).toBe("daily");
        expect(result).toEqual({
            type: "send",
            id: "msg-1",
            actor: { id: "https://app.example", type: "website" },
            object: { type: "delivery", status: "accepted", httpStatus: 201 },
        });
    });

    it("never echoes the delivery URL or the message in a result", async () => {
        const { webpush } = platform(
            () => new Response("gone", { status: 410 }),
        );
        const { result } = await send(webpush, job());
        const serialized = JSON.stringify(result);
        expect(serialized).not.toContain("secret-subscription-id");
        expect(serialized).not.toContain(CONTENT.toString("base64url"));
    });

    it("reports a dead subscription, a temporary failure and a refusal apart", async () => {
        const cases: Array<[() => Response, Record<string, unknown>]> = [
            [
                () => new Response(null, { status: 410 }),
                { status: "gone", httpStatus: 410 },
            ],
            [
                () => new Response(null, { status: 404 }),
                { status: "gone", httpStatus: 404 },
            ],
            [
                () =>
                    new Response(null, {
                        status: 429,
                        headers: { "retry-after": "120" },
                    }),
                { status: "retry", httpStatus: 429, retryAfter: 120 },
            ],
            [
                () => new Response(null, { status: 503 }),
                { status: "retry", httpStatus: 503 },
            ],
            [
                () =>
                    new Response('{"reason":"BadJwtToken"}', { status: 403 }),
                {
                    status: "rejected",
                    httpStatus: 403,
                    detail: '{"reason":"BadJwtToken"}',
                },
            ],
        ];
        for (const [answer, expected] of cases) {
            const { webpush } = platform(answer);
            const { err, result } = await send(webpush, job());
            expect(err).toBeNull();
            expect(result?.object).toEqual({ type: "delivery", ...expected });
        }
    });

    it("treats an unreachable push service as a temporary failure", async () => {
        const { webpush } = platform(() => {
            throw Object.assign(new TypeError("fetch failed"), {
                cause: new Error("connect ECONNREFUSED"),
            });
        });
        const { err, result } = await send(webpush, job());
        expect(err).toBeNull();
        expect(result?.object).toEqual({
            type: "delivery",
            status: "retry",
            detail: "connect ECONNREFUSED",
        });
    });

    it("only sends to allowlisted push services over https", async () => {
        for (const id of [
            "https://attacker.example/collect",
            "http://fcm.googleapis.com/fcm/send/x",
            "https://fcm.googleapis.com.attacker.example/x",
        ]) {
            const { webpush, calls } = platform(
                () => new Response(null, { status: 201 }),
            );
            const { result } = await send(
                webpush,
                job({ target: { id, type: "service" } }),
            );
            expect(calls).toHaveLength(0);
            expect((result?.object as { status: string }).status).toBe(
                "rejected",
            );
        }
        // An operator can replace the list, e.g. for a test push service.
        const { webpush, calls } = platform(
            () => new Response(null, { status: 201 }),
            { allowedHosts: ["push.internal"], allowInsecureHttp: true },
        );
        await send(
            webpush,
            job({ target: { id: "http://push.internal/s/1", type: "service" } }),
        );
        expect(calls).toHaveLength(1);
    });

    it("refuses content over the push services' 4 KB limit", async () => {
        const { webpush, calls } = platform(
            () => new Response(null, { status: 201 }),
        );
        const { result } = await send(
            webpush,
            job({
                object: {
                    type: "push",
                    content: Buffer.alloc(4097).toString("base64"),
                },
            }),
        );
        expect(calls).toHaveLength(0);
        expect((result?.object as { status: string }).status).toBe("rejected");
    });

    it("fails the job when the server has no signing key", async () => {
        const { webpush, calls } = platform(
            () => new Response(null, { status: 201 }),
            { vapid: undefined },
        );
        const { err } = await send(webpush, job());
        expect(String(err)).toContain("vapid.publicKey");
        expect(calls).toHaveLength(0);
    });

    it("refuses schedule, which the server handles when it is enabled", async () => {
        const { webpush } = platform(() => new Response(null));
        const err = await new Promise((resolve) =>
            webpush.schedule(job(), resolve),
        );
        expect(String(err)).toContain("not enabled");
    });
});

describe("webpush helpers", () => {
    it("matches hosts exactly or by subdomain wildcard", () => {
        const allowed = ["*.push.apple.com", "fcm.googleapis.com"];
        expect(hostAllowed("web.push.apple.com", allowed)).toBe(true);
        expect(hostAllowed("FCM.googleapis.com", allowed)).toBe(true);
        expect(hostAllowed("push.apple.com", allowed)).toBe(false);
        expect(hostAllowed("evilpush.apple.com", allowed)).toBe(false);
        expect(hostAllowed("x.fcm.googleapis.com", allowed)).toBe(false);
    });

    it("maps push service statuses", () => {
        expect(statusFor(201)).toBe("accepted");
        expect(statusFor(404)).toBe("gone");
        expect(statusFor(410)).toBe("gone");
        expect(statusFor(429)).toBe("retry");
        expect(statusFor(500)).toBe("retry");
        expect(statusFor(400)).toBe("rejected");
        expect(statusFor(401)).toBe("rejected");
        expect(statusFor(413)).toBe("rejected");
        // A redirect is not followed off the allowlisted host.
        expect(statusFor(302)).toBe("rejected");
    });

    it("reads Retry-After as seconds or as a date", () => {
        const now = Date.parse("2026-01-01T00:00:00Z");
        expect(retryAfterSeconds("30", now)).toBe(30);
        expect(
            retryAfterSeconds("Thu, 01 Jan 2026 00:01:00 GMT", now),
        ).toBe(60);
        expect(retryAfterSeconds(null, now)).toBeUndefined();
        expect(retryAfterSeconds("soon", now)).toBeUndefined();
    });
});
