/**
 * Tests for HTTP actions endpoint idempotency and GET replay behavior.
 */
import { describe, expect, it } from "bun:test";
import type { AddressInfo } from "node:net";
import {
    type ActivityStream,
    validateServiceDescriptor,
} from "@sockethub/schemas";
import express from "express";

import { buildPlatformRegistryPayload } from "../api-info.js";
import type { PlatformMap } from "../bootstrap/load-platforms.js";
import { apiVersionFromSemver, SOCKETHUB_VERSION } from "../version.js";
import { redactRequestId, registerHttpActionsRoutes } from "./actions.js";
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
        | "httpActions:idleTimeoutMs"
        | "httpActions:enabled"
        | "httpActions:path"
        | "sockethub:cors:origin",
        number | boolean | string
    >
>;

function fakePlatform(id: string, version: string) {
    return {
        id,
        moduleName: id,
        config: {},
        schemas: {
            name: id,
            version,
            contextUrl: `https://sockethub.org/ns/context/platform/${id}/v1.jsonld`,
            contextVersion: "1",
            schemaVersion: "1",
            credentials: {},
            messages: {},
        },
        version,
        apiVersion: apiVersionFromSemver(version),
        contextUrl: `https://sockethub.org/ns/context/platform/${id}/v1.jsonld`,
        contextVersion: "1",
        schemaVersion: "1",
        types: ["fetch"],
    };
}

const TEST_PLATFORMS: PlatformMap = new Map([
    ["metadata", fakePlatform("metadata", "2.0.3")],
    ["caldav", fakePlatform("caldav", "1.0.0-alpha.8")],
]);

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

const credentialsAckContext = [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/sockethub:internal/v1.jsonld",
];

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

function testConfig(configOverrides: ConfigOverrides) {
    return (key: string) => {
        const overrides = configOverrides as Record<string, unknown>;
        if (key in overrides) {
            return overrides[key];
        }
        return DEFAULT_CONFIG[key];
    };
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
            platforms: TEST_PLATFORMS,
        },
        {
            getConfig: testConfig(configOverrides),
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

    it("redacts credentials from streamed and cached acknowledgements", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            createMessageHandlersOverride: () => ({
                credentials: (payload: unknown, cb: (data: unknown) => void) =>
                    cb(payload),
                message: (_payload: unknown, cb: (data: unknown) => void) =>
                    cb({ type: "collection" }),
            }),
        });
        const requestId = "credentials-redaction";
        const credentials = {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/platform/caldav/v1.jsonld",
            ],
            type: "credentials",
            actor: { id: "caldav:alice", type: "person" },
            object: {
                type: "credentials",
                url: "https://calendar.example/alice/",
                username: "alice",
                password: "calendar-test-password",
            },
        };
        const { req, res, writes } = createReqRes({
            body: [credentials],
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(writes).toEqual([
            `${JSON.stringify({
                "@context": credentialsAckContext,
                type: "credentials-ack",
                actor: { id: "caldav:alice", type: "person" },
            })}\n`,
        ]);
        const cached = fakeRedis.lists.get(
            `sockethub:http-actions:results:${requestId}`,
        );
        expect(cached).toEqual([
            JSON.stringify({
                "@context": credentialsAckContext,
                type: "credentials-ack",
                actor: { id: "caldav:alice", type: "person" },
            }),
        ]);
        expect(JSON.stringify({ writes, cached })).not.toContain(
            "calendar-test-password",
        );
    });

    it("redacts credentials from handler error acknowledgements", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            createMessageHandlersOverride: () => ({
                credentials: (
                    payload: Record<string, unknown>,
                    cb: (data: unknown) => void,
                ) => cb({ ...payload, error: "invalid credentials" }),
                message: (_payload: unknown, cb: (data: unknown) => void) =>
                    cb({ type: "collection" }),
            }),
        });
        const requestId = "credentials-error-redaction";
        const credentials = {
            "@context": credentialsAckContext,
            type: "credentials",
            actor: { id: "caldav:alice", type: "person" },
            object: {
                type: "credentials",
                username: "alice",
                password: "calendar-test-password",
            },
        };
        const { req, res, writes } = createReqRes({
            body: [credentials],
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const expected = JSON.stringify({
            "@context": credentialsAckContext,
            type: "credentials-ack",
            actor: { id: "caldav:alice", type: "person" },
            error: "invalid credentials",
        });
        expect(writes).toEqual([`${expected}\n`]);
        expect(
            fakeRedis.lists.get(
                `sockethub:http-actions:results:${requestId}`,
            ),
        ).toEqual([expected]);
        expect(JSON.stringify({ writes, cached: fakeRedis.lists })).not.toContain(
            "calendar-test-password",
        );
        expect(JSON.stringify({ writes, cached: fakeRedis.lists })).not.toContain(
            '"username"',
        );
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

    it("accepts GET requestId via header", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const requestId = "req-458";
        const { req, res } = createReqRes({
            body: [singlePayload],
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        for (const header of ["x-request-id", "x-sockethub-request-id"]) {
            const getReqRes = createReqRes({
                headers: { [header]: requestId },
            });
            await handlers["GET:/sockethub-http"](getReqRes.req, getReqRes.res);

            expect(getReqRes.res.headers["x-idempotent-replay"]).toBe("true");
            expect(getReqRes.res.headers["content-type"]).toBe(
                "application/x-ndjson",
            );
            expect(getReqRes.writes.length).toBe(1);
        }
    });

    it("returns the service descriptor for a GET without a requestId", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({ fakeRedis });

        const { req, res, writes } = createReqRes({});
        await handlers["GET:/sockethub-http"](req, res);

        expect(res.statusCode).toBe(200);
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.jsonBody).toEqual({
            name: "sockethub",
            apiVersion: apiVersionFromSemver(SOCKETHUB_VERSION),
            platforms: [
                { id: "metadata", apiVersion: 2 },
                { id: "caldav", apiVersion: 1 },
            ],
        });
        // The served descriptor honours the schema published for clients.
        expect(validateServiceDescriptor(res.jsonBody)).toBeTrue();
        expect(writes.length).toBe(0);
        // Discovery never touches the idempotency store.
        expect(fakeRedis.store.size).toBe(0);
    });

    it("does not publish exact package versions in the descriptor", async () => {
        const handlers = buildHandlers({ fakeRedis: new FakeRedis() });

        const { req, res } = createReqRes({});
        await handlers["GET:/sockethub-http"](req, res);

        const serialized = JSON.stringify(res.jsonBody);
        expect(serialized).not.toContain(SOCKETHUB_VERSION);
        expect(serialized).not.toContain("2.0.3");
        expect(serialized).not.toContain("1.0.0-alpha.8");
    });

    it("rejects an invalid GET requestId instead of returning the descriptor", async () => {
        const handlers = buildHandlers({ fakeRedis: new FakeRedis() });

        for (const source of [
            { query: { requestId: "bad id!" } },
            { params: { requestId: "bad id!" } },
            { headers: { "x-request-id": "bad id!" } },
        ]) {
            const { req, res } = createReqRes(source);
            await handlers["GET:/sockethub-http"](req, res);

            expect(res.statusCode).toBe(400);
            expect(res.jsonBody).toEqual({
                error: "requestId contains invalid characters",
            });
        }
    });

    it("reports the same API versions as the Socket.IO bootstrap", async () => {
        const handlers = buildHandlers({ fakeRedis: new FakeRedis() });

        const { req, res } = createReqRes({});
        await handlers["GET:/sockethub-http"](req, res);

        const registry = buildPlatformRegistryPayload(TEST_PLATFORMS);
        expect(res.jsonBody.apiVersion).toBe(registry.apiVersion);
        expect(res.jsonBody.platforms).toEqual(
            registry.platforms.map(({ id, apiVersion }) => ({
                id,
                apiVersion,
            })),
        );
        // The bootstrap carries no exact package versions either.
        expect(registry).not.toHaveProperty("version");
        for (const platform of registry.platforms) {
            expect(platform).not.toHaveProperty("version");
        }
        expect(JSON.stringify(registry)).not.toContain(SOCKETHUB_VERSION);
    });

    it("serves the descriptor at a custom path", async () => {
        const handlers = buildHandlers({
            fakeRedis: new FakeRedis(),
            configOverrides: { "httpActions:path": "/custom/actions" },
        });

        expect(handlers["GET:/sockethub-http"]).toBeUndefined();
        const { req, res } = createReqRes({});
        await handlers["GET:/custom/actions"](req, res);

        expect(res.statusCode).toBe(200);
        expect(res.jsonBody.name).toBe("sockethub");
    });

    it("registers no descriptor when HTTP actions are disabled", () => {
        const handlers = buildHandlers({
            fakeRedis: new FakeRedis(),
            configOverrides: { "httpActions:enabled": false },
        });

        expect(Object.keys(handlers)).toEqual([]);
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

    it("persists a timeout error line so a GET replay matches the stream", async () => {
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            configOverrides: {
                "httpActions:requestTimeoutMs": 15,
                "httpActions:idleTimeoutMs": 0,
            },
            createMessageHandlersOverride: () => ({
                credentials: (_p: unknown, cb: (d: unknown) => void) =>
                    cb({ ok: true }),
                // Never call back: the request times out with the line still open.
                message: () => {},
            }),
        });

        const requestId = "timeout-persist";
        const { req, res, writes } = createReqRes({
            body: [singlePayload],
            headers: { "x-request-id": requestId },
        });
        await handlers["/sockethub-http"](req, res);
        // Let the request timeout fire and the redis write chain settle.
        await new Promise((resolve) => setTimeout(resolve, 40));

        // The client streamed exactly one line: the timeout error.
        expect(writes.length).toBe(1);
        expect(JSON.parse(writes[0]).error).toBe("request timeout");

        // A GET replay must return that same line.
        const getReqRes = createReqRes({ params: { requestId } });
        await handlers["GET:/sockethub-http/:requestId"](
            getReqRes.req,
            getReqRes.res,
        );
        expect(getReqRes.writes.length).toBe(1);
        expect(JSON.parse(getReqRes.writes[0]).error).toBe("request timeout");
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

    it("returns an error for a malformed credentials payload instead of throwing", async () => {
        // The payload is only classified before dispatch, not validated —
        // validation happens inside the handler chain. The ack builder must
        // therefore tolerate an actor that is not an object, rather than
        // reaching into it and taking the whole request down.
        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            configOverrides: {
                "httpActions:requireRequestId": false,
                "httpActions:requestTimeoutMs": 300,
                "httpActions:idleTimeoutMs": 300,
            },
            // Stands in for the real chain, which attaches the validation
            // error to the payload and hands it back.
            createMessageHandlersOverride: () => ({
                credentials: (
                    payload: ActivityStream,
                    cb: (data: unknown) => void,
                ) => cb({ ...payload, error: "invalid actor" }),
                message: (_payload: unknown, cb: (data: unknown) => void) =>
                    cb({ ok: true }),
            }),
        });

        const requestId = "malformed-actor-redaction";
        const { req, res, writes } = createReqRes({
            body: [
                {
                    type: "credentials",
                    actor: null,
                    object: {
                        type: "credentials",
                        username: "alice",
                        password: "malformed-test-password",
                    },
                },
            ],
            headers: { "x-request-id": requestId },
        });

        await handlers["/sockethub-http"](req, res);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(res.statusCode).toBe(200);
        expect(res.ended).toBeTrue();
        // The caller gets the validation error rather than a 500 from a
        // TypeError thrown while building the acknowledgement.
        expect(writes.join("")).toContain("invalid actor");
        // ...and without the submitted credentials riding along. There is no
        // actor id to build a redacted ack around, so only the message may
        // travel: the chain's error result still carries the whole activity,
        // and both the response and the idempotency cache are readable later.
        const exposed = JSON.stringify({
            writes,
            cached: fakeRedis.lists,
        });
        expect(exposed).not.toContain("malformed-test-password");
        expect(exposed).not.toContain('"username"');
    });

    it("saves credentials in payload order even when the first one is slow", async () => {
        // Two credentials for the same actor write the same key. Run
        // concurrently they could land in either order, leaving the stored
        // credentials disagreeing with the scope resolved for them.
        const saveOrder: Array<string> = [];
        let releaseFirst: (() => void) | undefined;

        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            configOverrides: {
                "httpActions:requireRequestId": false,
                "httpActions:requestTimeoutMs": 1000,
                "httpActions:idleTimeoutMs": 1000,
            },
            createMessageHandlersOverride: () => ({
                credentials: (
                    payload: ActivityStream,
                    cb: (data: unknown) => void,
                ) => {
                    const id = payload.object?.id;
                    if (id === "first") {
                        releaseFirst = () => {
                            saveOrder.push(id);
                            cb({ ok: true });
                        };
                        return;
                    }
                    saveOrder.push(id);
                    cb({ ok: true });
                },
                message: (_payload: unknown, cb: (data: unknown) => void) =>
                    cb({ ok: true }),
            }),
        });

        const { req, res } = createReqRes({
            body: [
                {
                    ...singlePayload,
                    type: "credentials",
                    object: { id: "first" },
                },
                {
                    ...singlePayload,
                    type: "credentials",
                    object: { id: "second" },
                },
            ],
        });
        const pending = handlers["/sockethub-http"](req, res);

        // The second must not have overtaken the stalled first.
        expect(saveOrder).toEqual([]);

        releaseFirst?.();
        await pending;

        expect(saveOrder).toEqual(["first", "second"]);
    });

    it("still dispatches messages when the client disconnects mid-credentials", async () => {
        // Credentials are processed as a first phase, so the message phase
        // resumes after an await. A disconnect during that await must not drop
        // the messages: the "close" handler deliberately keeps the platform
        // sessions registered so queued jobs finish.
        let releaseCredentials: ((data: unknown) => void) | undefined;
        let messageDispatched = false;

        const fakeRedis = new FakeRedis();
        const handlers = buildHandlers({
            fakeRedis,
            configOverrides: {
                "httpActions:requireRequestId": false,
                "httpActions:requestTimeoutMs": 500,
                "httpActions:idleTimeoutMs": 500,
            },
            createMessageHandlersOverride: () => ({
                credentials: (_payload: unknown, cb: (data: unknown) => void) => {
                    releaseCredentials = cb;
                },
                message: (_payload: unknown, cb: (data: unknown) => void) => {
                    messageDispatched = true;
                    cb({ ok: true });
                },
            }),
        });

        const { req, res } = createReqRes({
            body: [
                { ...singlePayload, type: "credentials" },
                singlePayload,
            ],
        });
        const pending = handlers["/sockethub-http"](req, res);

        // Still inside the credentials phase.
        expect(messageDispatched).toBeFalse();

        req.triggerClose();
        releaseCredentials?.({ ok: true });
        await pending;

        expect(messageDispatched).toBeTrue();
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

// CORS origin resolution is covered in ../cors.test.ts alongside
// parseCorsOrigins.

describe("http actions service descriptor over HTTP", () => {
    async function withServer(
        configOverrides: ConfigOverrides,
        run: (baseUrl: string) => Promise<void>,
    ) {
        const app = express();
        registerHttpActionsRoutes(
            app,
            {
                processManager: {} as any,
                parentId: "parent",
                parentSecret1: "secret-one",
                platforms: TEST_PLATFORMS,
            },
            {
                getConfig: testConfig(configOverrides),
                createRateLimiter: () => (_req, _res, next) => next(),
                getIdempotencyRedisConnection: () => new FakeRedis() as any,
            },
        );
        const server = app.listen(0, "127.0.0.1");
        await new Promise((resolve) => server.once("listening", resolve));
        const { port } = server.address() as AddressInfo;
        try {
            await run(`http://127.0.0.1:${port}`);
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    }

    it("responds 200 application/json with no-store", async () => {
        await withServer({}, async (baseUrl) => {
            const res = await fetch(`${baseUrl}/sockethub-http`);

            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toContain(
                "application/json",
            );
            expect(res.headers.get("cache-control")).toBe("no-store");
            expect(await res.json()).toEqual({
                name: "sockethub",
                apiVersion: apiVersionFromSemver(SOCKETHUB_VERSION),
                platforms: [
                    { id: "metadata", apiVersion: 2 },
                    { id: "caldav", apiVersion: 1 },
                ],
            });
        });
    });

    it("applies the HTTP actions CORS policy", async () => {
        await withServer(
            { "sockethub:cors:origin": "https://inbox.example" },
            async (baseUrl) => {
                const allowed = await fetch(`${baseUrl}/sockethub-http`, {
                    headers: { Origin: "https://inbox.example" },
                });
                expect(allowed.status).toBe(200);
                expect(allowed.headers.get("access-control-allow-origin")).toBe(
                    "https://inbox.example",
                );
                expect(allowed.headers.get("vary")).toContain("Origin");

                const denied = await fetch(`${baseUrl}/sockethub-http`, {
                    headers: { Origin: "https://evil.example" },
                });
                expect(
                    denied.headers.get("access-control-allow-origin"),
                ).toBeNull();
            },
        );
    });

    it("keeps replay lookups on NDJSON/404 semantics, not the descriptor", async () => {
        await withServer({}, async (baseUrl) => {
            const byPath = await fetch(`${baseUrl}/sockethub-http/unknown-id`);
            expect(byPath.status).toBe(404);

            const byQuery = await fetch(
                `${baseUrl}/sockethub-http?requestId=unknown-id`,
            );
            expect(byQuery.status).toBe(404);

            const invalid = await fetch(
                `${baseUrl}/sockethub-http?requestId=bad%20id`,
            );
            expect(invalid.status).toBe(400);
        });
    });
});

describe("redactRequestId", () => {
    it("keeps only a short prefix of long ids", () => {
        const id = "3f9c2b7e-1a4d-4c8e-9f0b-6d2a8e5c1b47";
        const redacted = redactRequestId(id);
        expect(redacted).toBe("3f9c2b7e…");
        expect(redacted).not.toContain(id.slice(8));
    });

    it("never echoes a short id in full", () => {
        expect(redactRequestId("12345")).toBe("1234…");
        expect(redactRequestId("abcdefgh")).toBe("abcd…");
    });
});
