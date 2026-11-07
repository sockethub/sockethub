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
import WhatsApp, { type WhatsAppCredentials } from "./index.js";
import { PlatformWhatsAppSchema } from "./schema.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const context = buildCanonicalContext(PlatformWhatsAppSchema.contextUrl);
const credentials: WhatsAppCredentials = {
    "@context": context,
    type: "credentials",
    actor: { id: "123", type: "person" },
    object: { type: "credentials", token: "test-secret", apiVersion: "v22.0" },
};
const job = (): ActivityStream => ({
    "@context": context,
    type: "send",
    actor: { id: "123", type: "person" },
    target: { id: "+15551234567", type: "person" },
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
const accepted = { messaging_product: "whatsapp", contacts: [{ input: "+15551234567", wa_id: "15551234567" }], messages: [{ id: "wamid.1" }] };

describe("whatsapp outgoing platform", () => {
    it("registers valid schemas and validates complete sends", () => {
        expect(validatePlatformSchema(PlatformWhatsAppSchema)).toBe("");
        addPlatformContext("whatsapp", PlatformWhatsAppSchema.contextUrl);
        addPlatformSchema(PlatformWhatsAppSchema.messages, "whatsapp/messages");
        expect(validateActivityStream(job())).toBe("");
        expect(validateActivityStream({ ...job(), target: { id: "15551234567", type: "person" } })).toBe("");
        for (const invalid of [
            { ...job(), target: undefined },
            { ...job(), target: { id: "555-1234", type: "person" } },
            { ...job(), target: { id: "+0123456789", type: "person" } },
            { ...job(), actor: { id: "../me?token=x", type: "person" } },
            { ...job(), object: { type: "message", content: "" } },
            { ...job(), object: { type: "message", content: "a".repeat(4097) } },
            { ...job(), object: { type: "message", content: "Hi", humanAgent: true } },
        ]) expect(validateActivityStream(invalid)).not.toBe("");
        const validate = new Ajv({ strict: false }).compile(PlatformWhatsAppSchema.credentials);
        expect(validate(credentials)).toBeTrue();
        for (const object of [
            { type: "credentials", apiVersion: "v22.0" },
            { ...credentials.object, token: "secret\r\nheader" },
            { ...credentials.object, apiVersion: "../../other" },
            { ...credentials.object, endpoint: "https://evil.test" },
        ]) expect(validate({ ...credentials, object })).toBeFalse();
    });

    it("sends text to the fixed endpoint and returns the accepted message ID", async () => {
        const fetchMock = stubFetch(async () => Response.json(accepted));
        const platform = new WhatsApp(session);
        const done = mock();
        await platform.send(job(), credentials, done);
        expect(platform.config).toEqual({ persist: false, requireCredentials: ["send"] });
        expect(platform.isInitialized()).toBeTrue();
        expect(fetchMock.mock.calls[0][0]).toBe("https://graph.facebook.com/v22.0/123/messages");
        const init = fetchMock.mock.calls[0][1]!;
        expect(init.method).toBe("POST");
        expect(init.redirect).toBe("error");
        expect(init.headers).toEqual({ authorization: "Bearer test-secret", "content-type": "application/json" });
        expect(init.signal).toBeInstanceOf(AbortSignal);
        expect(JSON.parse(String(init.body))).toEqual({
            messaging_product: "whatsapp", recipient_type: "individual", to: "+15551234567",
            type: "text", text: { body: "Hello", preview_url: false },
        });
        expect(done).toHaveBeenCalledTimes(1);
        const result = done.mock.calls[0][1];
        expect(result.object.id).toBe("wamid.1");
        expect(result.object.content).toBe("Hello");
        expect(new Ajv({ strict: false }).compile(PlatformWhatsAppSchema.responses)(result)).toBeTrue();
        const cleanup = mock();
        platform.cleanup(cleanup);
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("propagates Meta errors with codes and redacts credentials", async () => {
        stubFetch(async () => Response.json({ error: { message: "Invalid test-secret", code: 190 } }, { status: 401 }));
        const done = mock();
        await new WhatsApp(session).send(job(), credentials, done);
        expect(done).toHaveBeenCalledTimes(1);
        expect(done.mock.calls[0][0].message).toBe("whatsapp: send rejected (HTTP 401, code 190: Invalid [redacted])");
        expect(JSON.stringify(log.warn.mock.calls)).not.toContain("test-secret");
    });

    it("normalizes the 24-hour window error only for code 131047", async () => {
        for (const [code, windowClosed] of [[131047, true], [131026, false], [10, false]] as const) {
            stubFetch(async () => Response.json({ error: { code, message: "Meta detail" } }, { status: 400 }));
            const done = mock();
            await new WhatsApp(session).send(job(), credentials, done);
            const message = done.mock.calls[0][0].message;
            expect(message.startsWith("meta:messaging-window-closed")).toBe(windowClosed);
            expect(message).toContain(`code ${code}`);
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
            async () => Response.json({ messages: [] }),
            async () => Response.json({ messages: [{ id: 1 }] }),
            async () => Response.json({ messages: [null] }),
            async () => { throw new Error("network test-secret"); },
            async () => { throw new DOMException("test-secret", "TimeoutError"); },
        ]) {
            stubFetch(implementation);
            const done = mock();
            await new WhatsApp(session).send(job(), credentials, done);
            expect(done).toHaveBeenCalledTimes(1);
            expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
            expect(done.mock.calls[0][0].message).not.toContain("test-secret");
            expect(done.mock.calls[0][1]).toBeUndefined();
        }
    });
});
