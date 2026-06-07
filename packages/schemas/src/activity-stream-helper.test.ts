import { describe, expect, test } from "bun:test";
import type { ActivityStream } from "./types.js";
import {
    createActivityStreamProcessor,
    normalizeActivityStream,
} from "./activity-stream-helper.js";

const IRC_CONTEXT = [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
];

describe("normalizeActivityStream", () => {
    test("expands string actor to id object", () => {
        const stream = normalizeActivityStream({
            type: "send",
            "@context": IRC_CONTEXT,
            actor: "user@example.com",
            object: { type: "message", content: "hi" },
        } as ActivityStream);
        expect(stream.actor).toEqual({ id: "user@example.com" });
    });
});

describe("createActivityStreamProcessor", () => {
    test("allows dynamically registered object properties", () => {
        const processor = createActivityStreamProcessor({
            failOnUnknownProperties: true,
        });
        processor.registerObjectTypeExtensions("presence", ["extra"]);

        expect(() => {
            processor.process({
                type: "send",
                "@context": IRC_CONTEXT,
                actor: { id: "user", type: "person" },
                object: {
                    type: "presence",
                    presence: "online",
                    extra: { id: "registered-property" },
                },
            });
        }).not.toThrow();
    });

    test("allows additional properties for permissive schema object types", () => {
        const processor = createActivityStreamProcessor({
            failOnUnknownProperties: true,
        });

        expect(() => {
            processor.process({
                type: "send",
                "@context": IRC_CONTEXT,
                actor: { id: "user", type: "person" },
                object: {
                    type: "message",
                    content: "hello",
                    "xmpp:replace": { id: "old-message-id" },
                },
            });
        }).not.toThrow();
    });
});
