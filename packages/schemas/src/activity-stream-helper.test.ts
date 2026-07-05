import { describe, expect, test } from "bun:test";
import type { ActivityStream } from "./types.js";
import { normalizeActivityStream } from "./activity-stream-helper.js";

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
        } as unknown as ActivityStream);
        expect(stream.actor).toEqual({ id: "user@example.com" });
    });

    test("expands string target to id object and string object to content", () => {
        const stream = normalizeActivityStream({
            type: "send",
            "@context": IRC_CONTEXT,
            actor: { id: "user@example.com", type: "person" },
            target: "room@example.com",
            object: "hello there",
        } as unknown as ActivityStream);
        expect(stream.target).toEqual({ id: "room@example.com" });
        expect(stream.object).toEqual({ content: "hello there" });
    });

    test("expands string entries within an array ref", () => {
        const stream = normalizeActivityStream({
            type: "send",
            "@context": IRC_CONTEXT,
            actor: ["user@example.com", { id: "other", type: "person" }],
        } as unknown as ActivityStream);
        expect(stream.actor).toEqual([
            { id: "user@example.com" },
            { id: "other", type: "person" },
        ]);
    });

    test("leaves object refs untouched", () => {
        const stream = normalizeActivityStream({
            type: "send",
            "@context": IRC_CONTEXT,
            actor: { id: "user@example.com", type: "person" },
            object: { type: "message", content: "hi" },
        } as unknown as ActivityStream);
        expect(stream.actor).toEqual({
            id: "user@example.com",
            type: "person",
        });
        expect(stream.object).toEqual({ type: "message", content: "hi" });
    });
});
