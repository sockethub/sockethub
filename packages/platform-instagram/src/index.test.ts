import { afterEach, describe, expect, it, mock } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    buildCanonicalContext,
    type ActivityStream,
    type PlatformSession,
    validateActivityStream,
    validatePlatformSchema,
} from "@sockethub/schemas";
import Ajv from "ajv";
import Instagram, { type InstagramCredentials } from "./index.js";
import { PlatformInstagramSchema } from "./schema.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const context = buildCanonicalContext(PlatformInstagramSchema.contextUrl);
const credentials: InstagramCredentials = {
    "@context": context,
    type: "credentials",
    actor: { id: "123", type: "person" },
    object: { type: "credentials", token: "test-secret", apiVersion: "v22.0" },
};
const job = (): ActivityStream => ({
    "@context": context,
    type: "send",
    actor: { id: "123", type: "person" },
    target: { id: "456", type: "person" },
    object: { type: "message", content: "Hello" },
});
const log = { debug: mock(), info: mock(), warn: mock(), error: mock() };
const session: PlatformSession = {
    log, sendToClient: mock(), updateActor: async () => {},
};
function stubFetch(implementation: (url: unknown, init?: RequestInit) => Promise<Response>) {
    const stub = mock(implementation);
    globalThis.fetch = stub as unknown as typeof fetch;
    return stub;
}

describe("instagram outgoing platform", () => {
    it("registers valid schemas and validates complete sends", () => {
        expect(validatePlatformSchema(PlatformInstagramSchema)).toBe("");
        addPlatformContext("instagram", PlatformInstagramSchema.contextUrl);
        addPlatformSchema(PlatformInstagramSchema.messages, "instagram/messages");
        expect(validateActivityStream(job())).toBe("");
        for (const invalid of [
            { ...job(), target: undefined },
            { ...job(), actor: { id: "../me?token=x", type: "person" } },
            { ...job(), object: { type: "message", content: "" } },
            { ...job(), object: { type: "message", content: "a".repeat(2001) } },
            { ...job(), object: { type: "message", content: "Hi", humanAgent: "yes" } },
        ]) expect(validateActivityStream(invalid)).not.toBe("");
        const validate = new Ajv({ strict: false }).compile(PlatformInstagramSchema.credentials);
        expect(validate(credentials)).toBeTrue();
        for (const object of [
            { type: "credentials", apiVersion: "v22.0" },
            { ...credentials.object, token: "secret\r\nheader" },
            { ...credentials.object, apiVersion: "../../other" },
            { ...credentials.object, endpoint: "https://evil.test" },
        ]) expect(validate({ ...credentials, object })).toBeFalse();
    });

    it("sends text to the fixed endpoint and returns the accepted message ID", async () => {
        const fetchMock = stubFetch(async () => Response.json({ recipient_id: "456", message_id: "mid.1" }));
        const platform = new Instagram(session);
        const done = mock();
        await platform.send(job(), credentials, done);
        expect(platform.config).toEqual({ persist: false, requireCredentials: ["send"] });
        expect(platform.isInitialized()).toBeTrue();
        expect(fetchMock.mock.calls[0][0]).toBe("https://graph.instagram.com/v22.0/123/messages");
        const init = fetchMock.mock.calls[0][1]!;
        expect(init.method).toBe("POST");
        expect(init.redirect).toBe("error");
        expect(init.headers).toEqual({ authorization: "Bearer test-secret", "content-type": "application/json" });
        expect(init.signal).toBeInstanceOf(AbortSignal);
        expect(JSON.parse(String(init.body))).toEqual({ recipient: { id: "456" }, message: { text: "Hello" },  });
        expect(done).toHaveBeenCalledTimes(1);
        const result = done.mock.calls[0][1];
        expect(result.object.id).toBe("mid.1");
        expect(result.object.content).toBe("Hello");
        expect(new Ajv({ strict: false }).compile(PlatformInstagramSchema.responses)(result)).toBeTrue();
        const cleanup = mock();
        platform.cleanup(cleanup);
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("only tags messages explicitly marked as human-agent replies", async () => {
        const fetchMock = stubFetch(async () => Response.json({ message_id: "mid.2" }));
        const activity = job();
        activity.object.humanAgent = true;
        await new Instagram(session).send(activity, credentials, mock());
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toEqual({
            recipient: { id: "456" }, message: { text: "Hello" }, tag: "human_agent",
        });
    });

    it("routes Facebook Login tokens through the linked Page and tags only human replies", async () => {
        for (const humanAgent of [false, true]) {
            const fetchMock = stubFetch(async () => Response.json({ message_id: "mid.facebook" }));
            const activity = job();
            activity.object.humanAgent = humanAgent;
            const done = mock();
            await new Instagram(session).send(activity, {
                ...credentials,
                object: { ...credentials.object, login: "facebook", pageId: "789" },
            }, done);
            expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v22.0/789/messages");
            expect(JSON.parse(String(fetchMock.mock.calls[0][1]!.body))).toEqual({
                recipient: { id: "456" }, message: { text: "Hello" },
                messaging_type: humanAgent ? "MESSAGE_TAG" : "RESPONSE",
                ...(humanAgent ? { tag: "HUMAN_AGENT" } : {}),
            });
            expect(done.mock.calls[0][0]).toBeNull();
        }
    });

    it("requires a numeric Page ID only for Facebook Login", () => {
        const validate = new Ajv({ strict: false }).compile(PlatformInstagramSchema.credentials);
        expect(validate({ ...credentials, object: { ...credentials.object, login: "facebook", pageId: "789" } })).toBeTrue();
        expect(validate({ ...credentials, object: { ...credentials.object, login: "instagram" } })).toBeTrue();
        for (const fields of [
            { login: "facebook" },
            { login: "facebook", pageId: "../me" },
            { login: "instagram", pageId: "789" },
            { pageId: "789" },
            { login: "other" },
        ]) expect(validate({ ...credentials, object: { ...credentials.object, ...fields } })).toBeFalse();
    });

    it("propagates Meta errors with codes and redacts credentials", async () => {
        stubFetch(async () => Response.json({ error: { message: "Window closed test-secret", code: 10, error_subcode: 2018278 } }, { status: 400 }));
        const done = mock();
        await new Instagram(session).send(job(), credentials, done);
        expect(done).toHaveBeenCalledTimes(1);
        expect(done.mock.calls[0][0].message).toContain("code 10, subcode 2018278");
        expect(done.mock.calls[0][0].message).toContain("Window closed [redacted]");
        expect(JSON.stringify(log.warn.mock.calls)).not.toContain("test-secret");
    });

    it("normalizes documented messaging-window errors without misclassifying permissions", async () => {
        for (const [code, subcode, windowClosed] of [[10, 2018278, true], [10, 2534022, true], [10, 1404170, false], [190, 2018278, false]]) {
            stubFetch(async () => Response.json({ error: { code, error_subcode: subcode, message: "Meta detail" } }, { status: 400 }));
            const done = mock();
            await new Instagram(session).send(job(), credentials, done);
            const message = done.mock.calls[0][0].message;
            expect(message.startsWith("meta:messaging-window-closed")).toBe(windowClosed);
            expect(message).toContain(`code ${code}, subcode ${subcode}`);
            expect(message).toContain("Meta detail");
        }
    });

    it("handles HTTP failures, malformed responses, network errors and timeouts once", async () => {
        for (const implementation of [
            async () => new Response("bad gateway", { status: 502 }),
            async () => Response.json({}, { status: 403 }),
            async () => Response.json({ error: { code: 190 } }),
            async () => Response.json({}),
            async () => Response.json(null),
            async () => Response.json({ message_id: 1 }),
            async () => { throw new Error("network test-secret"); },
            async () => { throw new DOMException("test-secret", "TimeoutError"); },
        ]) {
            stubFetch(implementation);
            const done = mock();
            await new Instagram(session).send(job(), credentials, done);
            expect(done).toHaveBeenCalledTimes(1);
            expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(done.mock.calls[0][0].message).not.toContain("test-secret");
            expect(done.mock.calls[0][1]).toBeUndefined();
        }
    });
});
