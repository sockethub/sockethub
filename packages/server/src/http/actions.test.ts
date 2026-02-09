/**
 * Tests for HTTP actions endpoint idempotency and GET replay behavior.
 */
import { describe, expect, it } from "bun:test";
import * as sinon from "sinon";

import { registerHttpActionsRoutes } from "./actions.js";

class FakeRedis {
    store = new Map<string, string>();
    lists = new Map<string, Array<string>>();

    async set(
        key: string,
        value: string,
        mode?: string,
        _ttlMode?: string,
        _ttl?: number,
    ) {
        if (mode === "NX" && this.store.has(key)) {
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
    "httpActions:path": "/sockethub/http",
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
}: {
    configOverrides?: ConfigOverrides;
    fakeRedis: FakeRedis;
}) {
    const handlers: Record<string, any> = {};
    const app: any = {
        post: (path: string, _rateLimiter: any, handler: any) => {
            handlers[path] = handler;
        },
        get: (path: string, _rateLimiter: any, handler: any) => {
            handlers[`GET:${path}`] = handler;
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
            createHttpRateLimiter: () => (_req, _res, next) => next(),
            createMessageHandlers: () => ({
                credentials: (_payload, cb) => cb({ ok: true, id: "c1" }),
                message: (_payload, cb) => cb({ ok: true, id: "m1" }),
                activityObject: (_payload, cb) => cb({ ok: true, id: "a1" }),
            }),
            createCredentialsStore: () => ({
                save: async () => 1,
                get: async () => undefined,
            }),
            getIdempotencyRedisConnection: () => fakeRedis as any,
        },
    );

    return handlers;
}

describe("http actions", () => {
    it("streams results and caches for idempotent replay", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const requestId = "req-123";
        const { req, res, writes } = createReqRes({
            body: payloads,
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub/http"](req, res);

        expect(res.ended).toBeTrue();
        expect(writes.length).toBe(2);

        await new Promise((resolve) => setTimeout(resolve, 0));

        const replay = createReqRes({
            body: payloads,
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub/http"](replay.req, replay.res);
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

        await handlers["/sockethub/http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const getReqRes = createReqRes({
            params: { requestId },
        });
        await handlers["GET:/sockethub/http/:requestId"](
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

        await handlers["/sockethub/http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const getReqRes = createReqRes({
            query: { requestId },
        });
        await handlers["GET:/sockethub/http"](getReqRes.req, getReqRes.res);

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

        await handlers["/sockethub/http"](req, res);

        expect(res.statusCode).toBe(413);
        expect(res.jsonBody.error).toContain("payload limit exceeded");
    });

    it("rejects empty payload arrays", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const { req, res } = createReqRes({
            body: [],
        });

        await handlers["/sockethub/http"](req, res);

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

        await handlers["/sockethub/http"](req, res);

        expect(res.statusCode).toBe(400);
        expect(res.jsonBody.error).toBe("requestId is required");
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

        await handlers["/sockethub/http"](req, res);

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

        await handlers["GET:/sockethub/http/:requestId"](
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

        await handlers["GET:/sockethub/http/:requestId"](
            getReqRes.req,
            getReqRes.res,
        );

        expect(getReqRes.res.statusCode).toBe(404);
        expect(getReqRes.res.jsonBody.error).toBe("request not found");
    });
});
