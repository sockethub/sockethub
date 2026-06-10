import { describe, expect, test } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
import { stanzas } from "./incoming-handlers.test.data.js";
import { PlatformSchema } from "./schema.js";

addPlatformSchema(PlatformSchema.responses, "xmpp/responses");
addPlatformContext("xmpp", PlatformSchema.contextUrl);

const CTX = [PlatformSchema.contextUrl];

describe("xmpp responses schema", () => {
    // Every message the incoming handlers emit (the expected `asobject` in the
    // fixtures) must satisfy the strict outbound schema.
    for (const [name, , asobject] of stanzas) {
        if (!asobject || typeof asobject.type !== "string") {
            continue;
        }
        test(`accepts emitted message: ${name}`, () => {
            // biome-ignore lint/suspicious/noExplicitAny: fixture
            expect(validateActivityStreamResponse(asobject as any)).toEqual("");
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
                object: { type: "message", content: "x", bogus: "y" },
                // biome-ignore lint/suspicious/noExplicitAny: test
            } as any),
        ).not.toEqual("");
    });
});
