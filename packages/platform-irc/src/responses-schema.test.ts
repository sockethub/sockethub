import { describe, expect, test } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    buildCanonicalContext,
    validateActivityStream,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
// Canonical irc2as translation outputs — the messages the irc platform emits.
import { TestData } from "../../irc2as/src/index.test.data.js";
import { PlatformIrcSchema } from "./schema.js";

addPlatformSchema(PlatformIrcSchema.responses, "irc/responses");
addPlatformSchema(PlatformIrcSchema.messages, "irc/messages");
addPlatformContext("irc", PlatformIrcSchema.contextUrl);

const CTX = [PlatformIrcSchema.contextUrl];
const FULL_CTX = buildCanonicalContext(PlatformIrcSchema.contextUrl);

describe("irc responses schema", () => {
    for (const [index, stream] of (
        TestData as Array<Record<string, unknown>>
    ).entries()) {
        if (!stream || typeof stream.type !== "string") {
            continue;
        }
        test(`accepts irc2as output #${index} (${stream.type})`, () => {
            // biome-ignore lint/suspicious/noExplicitAny: fixture
            expect(validateActivityStreamResponse(stream as any)).toEqual("");
        });
    }

    test("rejects an unknown message type", () => {
        expect(
            validateActivityStreamResponse({
                "@context": CTX,
                type: "bogus",
                actor: { id: "a@b", type: "person" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).not.toEqual("");
    });

    test("rejects an unknown field on a message object", () => {
        expect(
            validateActivityStreamResponse({
                "@context": CTX,
                type: "send",
                actor: { id: "a@b", type: "person" },
                target: { id: "#x@localhost", type: "room" },
                object: { type: "message", content: "x", bogus: "y" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).not.toEqual("");
    });
});

describe("irc messages (inbound) object validation", () => {
    test("accepts a real inbound send (message object)", () => {
        expect(
            validateActivityStream({
                "@context": FULL_CTX,
                type: "send",
                actor: { id: "u@localhost", type: "person" },
                target: { id: "#room@localhost", type: "room" },
                object: { type: "message", content: "har dee dar" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).toEqual("");
    });

    test("accepts an inbound update (topic object)", () => {
        expect(
            validateActivityStream({
                "@context": FULL_CTX,
                type: "update",
                actor: { id: "u@localhost", type: "person" },
                target: { id: "#room@localhost", type: "room" },
                object: { type: "topic", content: "new topic" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).toEqual("");
    });

    test("rejects an inbound object with an unknown field", () => {
        expect(
            validateActivityStream({
                "@context": FULL_CTX,
                type: "send",
                actor: { id: "u@localhost", type: "person" },
                target: { id: "#room@localhost", type: "room" },
                object: { type: "message", content: "hi", bogus: "x" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).not.toEqual("");
    });

    test("rejects a room target that is not server-qualified", () => {
        expect(
            validateActivityStream({
                "@context": FULL_CTX,
                type: "join",
                actor: { id: "u@localhost", type: "person" },
                target: { id: "#bare", type: "room" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).not.toEqual("");
    });

    test("rejects a room target missing the channel sigil after the server", () => {
        expect(
            validateActivityStream({
                "@context": FULL_CTX,
                type: "join",
                actor: { id: "u@localhost", type: "person" },
                target: { id: "localhost/nick", type: "room" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).not.toEqual("");
    });

    test("accepts a person (PM) target without room qualification", () => {
        expect(
            validateActivityStream({
                "@context": FULL_CTX,
                type: "send",
                actor: { id: "u@localhost", type: "person" },
                target: { id: "friend@localhost", type: "person" },
                object: { type: "message", content: "hi" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).toEqual("");
    });
});
