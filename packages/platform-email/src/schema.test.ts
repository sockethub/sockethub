import { describe, expect, it } from "bun:test";
import { addPlatformContext, addPlatformSchema, buildCanonicalContext, validateActivityStream, validatePlatformSchema } from "@sockethub/schemas";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { PlatformEmailSchema } from "./schema.js";

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const credentials = ajv.compile(PlatformEmailSchema.credentials);
addPlatformContext("email", PlatformEmailSchema.contextUrl);
addPlatformSchema(PlatformEmailSchema.messages, "email/messages");
const message = (value: Record<string, unknown>) => validateActivityStream({
    "@context": buildCanonicalContext(PlatformEmailSchema.contextUrl),
    actor: { id: "me@example.com", type: "person" },
    ...value,
} as Parameters<typeof validateActivityStream>[0]) === "";
const server = { host: "mail.example.com", username: "me@example.com", password: "test-password" };

describe("email schema", () => {
    it("registers as a valid platform", () => {
        expect(validatePlatformSchema(PlatformEmailSchema)).toBe("");
    });
    it("requires at least one authenticated server and a sender address", () => {
        expect(credentials({ object: { type: "credentials", from: "me@example.com", imap: server } })).toBeTrue();
        expect(credentials({ object: { type: "credentials", from: "me@example.com", smtp: { ...server, password: undefined, token: "access-token" } } })).toBeTrue();
        expect(credentials({ object: { type: "credentials", from: "me@example.com" } })).toBeFalse();
        expect(credentials({ object: { type: "credentials", from: "invalid", imap: server } })).toBeFalse();
        expect(credentials({ object: { type: "credentials", from: "me@example.com", imap: { ...server, token: "both" } } })).toBeFalse();
        expect(credentials({ object: { type: "credentials", from: "me@example.com", imap: { ...server, tls: { rejectUnauthorized: false } } } })).toBeFalse();
    });
    it("accepts bounded folder fetches and address-filtered watches", () => {
        expect(message({ type: "fetch", object: { folders: ["INBOX", "Orders"], from: ["friend@example.com"], to: ["me@example.com"], match: "any", limit: 10, cursors: { INBOX: { uidValidity: "7", uid: 3 } } } })).toBeTrue();
        expect(message({ type: "watch", object: { folder: "Orders", to: ["me@example.com"] } })).toBeTrue();
        expect(message({ type: "fetch", object: { limit: 100000 } })).toBeFalse();
        expect(message({ type: "watch", object: { folders: ["INBOX", "Orders"] } })).toBeFalse();
        expect(message({ type: "fetch", object: { folders: ["INBOX\r\nLOGOUT"] } })).toBeFalse();
    });
    it("requires recipients and a body, and rejects unsupported attachment inputs", () => {
        expect(message({ type: "send", object: { to: ["friend@example.com"], content: "Hello" } })).toBeTrue();
        expect(message({ type: "send", object: { to: ["friend@example.com"], html: "<p>Hello</p>" } })).toBeTrue();
        expect(message({ type: "send", object: { to: ["friend@example.com"] } })).toBeFalse();
        expect(message({ type: "send", object: { to: ["invalid"], content: "Hello" } })).toBeFalse();
        expect(message({ type: "send", object: { to: ["friend@example.com"], content: "Hello", attachments: [{ path: "/etc/passwd" }] } })).toBeFalse();
        expect(message({ type: "send", object: { to: ["friend@example.com"], content: "Hello", subject: "Hi\r\nBcc: other@example.com" } })).toBeFalse();
    });
});
