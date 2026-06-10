import { describe, expect, test } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
// Canonical irc2as translation outputs — the messages the irc platform emits.
import { TestData } from "../../irc2as/src/index.test.data.js";
import { PlatformIrcSchema } from "./schema.js";

addPlatformSchema(PlatformIrcSchema.responses, "irc/responses");
addPlatformContext("irc", PlatformIrcSchema.contextUrl);

const CTX = [PlatformIrcSchema.contextUrl];

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
                target: { id: "localhost/#x", type: "room" },
                object: { type: "message", content: "x", bogus: "y" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).not.toEqual("");
    });
});
