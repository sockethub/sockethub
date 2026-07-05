/**
 * Tests for HTTP actions endpoint idempotency and GET replay behavior.
 */
import { describe, expect, it } from "bun:test";

import { registerHttpActionsRoutes, resolveAllowedOrigin } from "./actions.js";
import {
    hasHttpSessions,
    unregisterHttpSession,
} from "./session-registry.js";

class FakeRedis {
    store = new Map<string, string>();
    lists = new Map<string, Array<string>>();

    async set(
        key: string,
        value: string,
        arg1?: string | number,
        arg2?: string | number,
        arg3?: string | number,
    ) {
        const args = [arg1, arg2, arg3];
        const nx = args.includes("NX");

        if (nx && this.store.has(key)) {
            return null;
        }
        this.store.set(key, value);
        return "OK";
    }

    async get(key: string) {
        return this.store.get(key) ?? null;
    }

    async del(key: string) {
        this.store.delete(key);
        this.lists.delete(key);
        return 1;
    }

    async pexpire(_key: string, _ttl: number) {
        return 1;
    }

    async rpush(key: string, value: string) {
        const list = this.lists.get(key) ?? [];
        list.push(value);
        this.lists.set(key, list);
        return list.length;
    }

    async lrange(key: string, start: number, end: number) {
        const list = this.lists.get(key) ?? [];
        return list.slice(start, end + 1);
    }
}

type ConfigOverrides = Partial<
    Record<
        | "httpActions:maxMessagesPerRequest"
        | "httpActions:requireRequestId"
        | "httpActions:idempotencyTtlMs"
        | "httpActions:requestTimeoutMs"
        | "httpActions:idleTimeoutMs",
        number | boolean
    >
>;

const DEFAULT_CONFIG: Record<string, unknown> = {
    "httpActions:enabled": true,
    "httpActions:path": "/sockethub-http",
    "httpActions:requireRequestId": true,
    "httpActions:maxMessagesPerRequest": 20,
    "httpActions:idempotencyTtlMs": 1000,
    "httpActions:requestTimeoutMs": 1000,
    "httpActions:idleTimeoutMs": 1000,
    rateLimiter: {
        windowMs: 1000,
        maxRequests: 100,
        blockDurationMs: 5000,
    },
    redis: { url: "redis://test" },
};

const payloads = [
    { context: "xmpp", type: "credentials", actor: { id: "me" } },
    { context: "xmpp", type: "connect", actor: { id: "me" } },
];

const singlePayload = {
    context: "xmpp",
    type: "connect",
    actor: { id: "me" },
};

function createReqRes({
    body,
    headers = {},
    params = {},
    query = {},
}: {
    body?: unknown;
    headers?: Record<string, string>;
    params?: Record<string, string>;
    query?: Record<string, string>;
}) {
    const writes: Array<string> = [];
    const res: any = {
        headers: {},
        statusCode: 200,
        ended: false,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        setHeader(name: string, value: string) {
            this.headers[name.toLowerCase()] = value;
        },
        write(chunk: string) {
            writes.push(String(chunk));
            return true;
        },
        json(payload: unknown) {
            this.jsonBody = payload;
            this.end();
        },
        end() {
            this.ended = true;
        },
        flushHeaders() {},
    };

    let closeHandler: (() => void) | undefined;
    const req: any = {
        body,
        params,
        query,
        header: (name: string) => headers[name.toLowerCase()],
        on: (event: string, handler: () => void) => {
            if (event === "close") {
                closeHandler = handler;
            }
        },
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
        triggerClose: () => closeHandler?.(),
    };

    return { req, res, writes };
}

function buildHandlers({
    configOverrides = {},
    fakeRedis,
    createMessageHandlersOverride,
    onTeardown,
}: {
    configOverrides?: ConfigOverrides;
    fakeRedis: FakeRedis;
    createMessageHandlersOverride?: (...args: Array<any>) => any;
    onTeardown?: () => void;
}) {
    const handlers: Record<string, any> = {};
    const app: any = {
        post: (path: string, ...args: Array<any>) => {
            handlers[path] = args[args.length - 1];
        },
        get: (path: string, ...args: Array<any>) => {
            handlers[`GET:${path}`] = args[args.length - 1];
        },
        options: (path: string, ...args: Array<any>) => {
            handlers[`OPTIONS:${path}`] = args[args.length - 1];
        },
    };

    registerHttpActionsRoutes(
        app,
        {
            processManager: {} as any,
            parentId: "parent",
            parentSecret1: "secret-one",
        },
        {
            getConfig: (key: string) => {
                const overrides = configOverrides as Record<string, unknown>;
                if (key in overrides) {
                    return overrides[key];
                }
                return DEFAULT_CONFIG[key];
            },
            createRateLimiter: () => (_req, _res, next) => next(),
            createMessageHandlers:
                createMessageHandlersOverride ??
                (() => ({
                    credentials: (_payload, cb) => cb({ ok: true, id: "c1" }),
                    message: (_payload, cb) => cb({ ok: true, id: "m1" }),
                })),
            createCredentialsStore: () => ({
                save: async () => 1,
                get: async () => undefined,
                teardown: async () => {
                    onTeardown?.();
                },
            }),
            getIdempotencyRedisConnection: () => fakeRedis as any,
        },
    );

    return handlers;
}

describe("http actions", () => {
    it("accepts canonical @context messages", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const { req, res, writes } = createReqRes({
            body: {
                "@context": [
                    "https://www.w3.org/ns/activitystreams",
                    "https://sockethub.org/ns/context/platform/dummy/v1.jsonld",
                ],
                type: "echo",
                actor: { id: "me" },
                object: { type: "Note", content: "hello" },
            },
            headers: { "x-request-id": "ctx-123" },
        });

        await handlers["/sockethub-http"](req, res);

        expect(res.statusCode).toBe(200);
        expect(writes.length).toBe(1);
    });

    it("tears down the session credential store after completion", async () => {
        const fakeRedis = new FakeRedis();
        let teardowns = 0;
        const handlers = buildHandlers({
            fakeRedis,
            onTeardown: () => {
                teardowns += 1;
            },
        });

        const { req, res } = createReqRes({
            body: [singlePayload],
            headers: { "x-request-id": "teardown-req" },
        });

        await handlers["/sockethub-http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(res.ended).toBeTrue();
        expect(teardowns).toBe(1);
    });

    it("streams results and caches for idempotent replay", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const requestId = "req-123";
        const { req, res, writes } = createReqRes({
            body: payloads,
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(res.ended).toBeTrue();
        expect(writes.length).toBe(2);

        const replay = createReqRes({
            body: payloads,
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](replay.req, replay.res);
        expect(replay.res.headers["x-idempotent-replay"]).toBe("true");
        expect(replay.writes.length).toBe(2);
    });

    it("serves cached results via GET", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const requestId = "req-456";
        const { req, res } = createReqRes({
            body: [singlePayload],
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const getReqRes = createReqRes({
            params: { requestId },
        });
        await handlers["GET:/sockethub-http/:requestId"](
            getReqRes.req,
            getReqRes.res,
        );

        expect(getReqRes.res.headers["x-idempotent-replay"]).toBe("true");
        expect(getReqRes.writes.length).toBe(1);
    });

    it("accepts GET requestId via query string", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const requestId = "req-457";
        const { req, res } = createReqRes({
            body: [singlePayload],
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const getReqRes = createReqRes({
            query: { requestId },
        });
        await handlers["GET:/sockethub-http"](getReqRes.req, getReqRes.res);

        expect(getReqRes.res.headers["x-idempotent-replay"]).toBe("true");
        expect(getReqRes.writes.length).toBe(1);
    });

    it("rejects requests over maxMessagesPerRequest", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            configOverrides: { "httpActions:maxMessagesPerRequest": 1 },
        });

        const requestId = "req-789";
        const { req, res } = createReqRes({
            body: payloads,
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](req, res);

        expect(res.statusCode).toBe(413);
        expect(res.jsonBody.error).toContain("payload limit exceeded");
    });

    it("rejects empty payload arrays", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const { req, res } = createReqRes({
            body: [],
        });

        await handlers["/sockethub-http"](req, res);

        expect(res.statusCode).toBe(400);
        expect(res.jsonBody.error).toContain(
            "request body must be a payload object or array of payloads",
        );
    });

    it("requires requestId when configured", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const { req, res } = createReqRes({
            body: payloads,
        });

        await handlers["/sockethub-http"](req, res);

        expect(res.statusCode).toBe(400);
        expect(res.jsonBody.error).toBe("requestId is required");
    });

    it("rejects invalid requestId values", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const { req, res } = createReqRes({
            body: payloads,
            headers: { "x-request-id": "bad value with spaces" },
        });

        await handlers["/sockethub-http"](req, res);

        expect(res.statusCode).toBe(400);
        expect(res.jsonBody.error).toBe(
            "requestId contains invalid characters",
        );
    });

    it("allows requests without requestId when requireRequestId is false", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            configOverrides: { "httpActions:requireRequestId": false },
        });

        const { req, res } = createReqRes({
            body: payloads,
        });

        await handlers["/sockethub-http"](req, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers["x-request-id"]).toBeDefined();
        expect(res.ended).toBeTrue();
    });

    it("returns 202 when request is still in progress", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const requestId = "req-101";
        await fakeRedis.set(
            `sockethub:http-actions:status:${requestId}`,
            "in-progress",
        );

        const getReqRes = createReqRes({
            params: { requestId },
        });

        await handlers["GET:/sockethub-http/:requestId"](
            getReqRes.req,
            getReqRes.res,
        );

        expect(getReqRes.res.statusCode).toBe(202);
        expect(getReqRes.res.jsonBody.status).toBe("in-progress");
    });

    it("returns 404 when request id is unknown", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const getReqRes = createReqRes({
            params: { requestId: "req-missing" },
        });

        await handlers["GET:/sockethub-http/:requestId"](
            getReqRes.req,
            getReqRes.res,
        );

        expect(getReqRes.res.statusCode).toBe(404);
        expect(getReqRes.res.jsonBody.error).toBe("request not found");
    });

    it("returns 503 when the idempotency store fails on GET", async () => {
        const fakeRedis = new FakeRedis();
        fakeRedis.get = async () => {
            throw new Error("redis down");
        };
        const handlers = buildHandlers({ fakeRedis });

        const getReqRes = createReqRes({ params: { requestId: "req-503" } });
        await handlers["GET:/sockethub-http/:requestId"](
            getReqRes.req,
            getReqRes.res,
        );

        expect(getReqRes.res.statusCode).toBe(503);
        expect(getReqRes.res.jsonBody.error).toBe(
            "idempotency store unavailable",
        );
    });

    it("returns 503 when the idempotency store fails on POST claim", async () => {
        const fakeRedis = new FakeRedis();
        fakeRedis.set = async () => {
            throw new Error("redis down");
        };
        const handlers = buildHandlers({ fakeRedis });

        const { req, res } = createReqRes({
            body: [singlePayload],
            headers: { "x-request-id": "req-503-post" },
        });
        await handlers["/sockethub-http"](req, res);

        expect(res.statusCode).toBe(503);
        expect(res.jsonBody.error).toBe("idempotency store unavailable");
    });

    it("cleans up tracked platform sessions after an idempotent client disconnect times out", async () => {
        const platformId = "platform-http-cleanup";
        while (hasHttpSessions(platformId)) {
            unregisterHttpSession(platformId);
        }

        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            configOverrides: {
                "httpActions:requestTimeoutMs": 20,
                "httpActions:idleTimeoutMs": 10,
            },
            createMessageHandlersOverride: ({ onPlatformInstance }: any) => ({
                credentials: (_payload: unknown, cb: (data: unknown) => void) =>
                    cb({ ok: true, id: "c1" }),
                message: (_payload: unknown, _cb: (data: unknown) => void) => {
                    onPlatformInstance?.({
                        id: platformId,
                        config: { persist: true },
                    });
                },
            }),
        });

        const { req, res } = createReqRes({
            body: [singlePayload],
            headers: { "x-request-id": "timeout-123" },
        });

        await handlers["/sockethub-http"](req, res);
        expect(hasHttpSessions(platformId)).toBeTrue();

        req.triggerClose();
        await new Promise((resolve) => setTimeout(resolve, 40));

        expect(hasHttpSessions(platformId)).toBeFalse();
        expect(res.ended).toBeTrue();
    });

    it("best-effort disconnect keeps platform tracking until jobs finish", async () => {
        const platformId = "platform-http-besteffort";
        while (hasHttpSessions(platformId)) {
            unregisterHttpSession(platformId);
        }

        const fakeRedis = new FakeRedis();
        // No requestId (best-effort mode); a job stays pending after disconnect.
        const handlers = buildHandlers({
            fakeRedis,
            configOverrides: {
                "httpActions:requireRequestId": false,
                "httpActions:requestTimeoutMs": 30,
                "httpActions:idleTimeoutMs": 20,
            },
            createMessageHandlersOverride: ({ onPlatformInstance }: any) => ({
                credentials: (_payload: unknown, cb: (data: unknown) => void) =>
                    cb({ ok: true, id: "c1" }),
                message: (_payload: unknown, _cb: (data: unknown) => void) => {
                    onPlatformInstance?.({
                        id: platformId,
                        config: { persist: true },
                    });
                    // never call back -> job stays pending
                },
            }),
        });

        const { req, res } = createReqRes({ body: [singlePayload] });
        await handlers["/sockethub-http"](req, res);
        expect(hasHttpSessions(platformId)).toBeTrue();

        // Disconnect while the job is still pending: tracking must survive so
        // the janitor cannot reap the platform mid-job.
        req.triggerClose();
        expect(hasHttpSessions(platformId)).toBeTrue();

        // Only the request timeout finally releases it.
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(hasHttpSessions(platformId)).toBeFalse();
    });

    it("propagates an unexpected setup error to Express", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            createMessageHandlersOverride: () => {
                throw new Error("boom during setup");
            },
        });

        const { req, res } = createReqRes({
            body: [singlePayload],
            headers: { "x-request-id": "throws-1" },
        });

        // The handler no longer self-catches: Express 5 forwards a rejected
        // async route handler to its error middleware (Express 4 would have
        // crashed the process). Assert the error propagates rather than being
        // swallowed.
        let threw = false;
        try {
            await handlers["/sockethub-http"](req, res);
        } catch (err) {
            threw = true;
            expect(String(err)).toContain("boom during setup");
        }
        expect(threw).toBeTrue();
    });
});

describe("resolveAllowedOrigin", () => {
    it("allows any origin when configured as * or unset", () => {
        expect(resolveAllowedOrigin("*", "https://app.example")).toBe("*");
        expect(resolveAllowedOrigin(undefined, "https://app.example")).toBe(
            "*",
        );
        expect(resolveAllowedOrigin("", "https://app.example")).toBe("*");
    });

    it("echoes a request origin that is in the configured allow-list", () => {
        expect(
            resolveAllowedOrigin(
                "https://a.example, https://b.example",
                "https://b.example",
            ),
        ).toBe("https://b.example");
    });

    it("returns undefined for an origin not in the allow-list", () => {
        expect(
            resolveAllowedOrigin("https://a.example", "https://evil.example"),
        ).toBeUndefined();
    });

    it("returns undefined for a restricted list when no origin is sent", () => {
        expect(
            resolveAllowedOrigin("https://a.example", undefined),
        ).toBeUndefined();
    });
});
