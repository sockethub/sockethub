import { describe, expect, it } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    validateActivityStream,
    validateActivityStreamResponse,
    validatePlatformSchema,
} from "@sockethub/schemas";
import { PlatformWebPushSchema } from "./schema";

addPlatformSchema(PlatformWebPushSchema.responses, "webpush/responses");
addPlatformSchema(PlatformWebPushSchema.messages, "webpush/messages");
addPlatformContext("webpush", PlatformWebPushSchema.contextUrl);

const context = [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    PlatformWebPushSchema.contextUrl,
];
const actor = { id: "https://app.example", type: "website" };
const target = {
    id: "https://web.push.apple.com/QGp-secret",
    type: "service",
};
const content = Buffer.alloc(64, 1).toString("base64url");
const base = { "@context": context, actor, target };

describe("webpush platform schema", () => {
    it("is a valid platform schema", () => {
        expect(validatePlatformSchema(PlatformWebPushSchema)).toBe("");
    });

    it("accepts a send, with base64 or base64url content", () => {
        for (const value of [content, Buffer.alloc(64, 255).toString("base64")]) {
            expect(
                validateActivityStream({
                    ...base,
                    type: "send",
                    object: {
                        type: "push",
                        content: value,
                        ttl: 3600,
                        urgency: "normal",
                        topic: "daily-reminder",
                    },
                }),
            ).toEqual("");
        }
    });

    it("accepts a schedule, including an empty one that cancels", () => {
        for (const items of [
            [],
            [{ deliverAt: "2026-12-01T08:00:00Z", content, ttl: 7200 }],
        ]) {
            expect(
                validateActivityStream({
                    ...base,
                    type: "schedule",
                    object: { type: "schedule", items },
                }),
            ).toEqual("");
        }
    });

    it("rejects malformed messages", () => {
        const send = { type: "push", content };
        for (const msg of [
            // each verb takes only its own object
            { ...base, type: "send", object: { type: "schedule", items: [] } },
            { ...base, type: "schedule", object: send },
            { ...base, type: "send", object: { type: "push" } },
            { ...base, type: "send", object: { ...send, content: "not base64!" } },
            {
                ...base,
                type: "send",
                object: { ...send, content: "A".repeat(5465) },
            },
            { ...base, type: "send", object: { ...send, ttl: 2419201 } },
            { ...base, type: "send", object: { ...send, urgency: "urgent" } },
            { ...base, type: "send", object: { ...send, topic: "has space" } },
            // no delivery URL
            { "@context": context, actor, type: "send", object: send },
            {
                ...base,
                target: { id: "ftp://example.com/x", type: "service" },
                type: "send",
                object: send,
            },
            // the actor is the app, never a person
            {
                ...base,
                actor: { id: "alice@example.org", type: "person" },
                type: "send",
                object: send,
            },
            {
                ...base,
                type: "schedule",
                object: {
                    type: "schedule",
                    items: [{ deliverAt: "tomorrow", content }],
                },
            },
            {
                ...base,
                type: "schedule",
                object: { type: "schedule", items: [{ content }] },
            },
        ]) {
            expect(validateActivityStream(msg as never)).not.toEqual("");
        }
    });

    it("validates results, which carry no delivery URL", () => {
        const result = (object: unknown, type = "send") => ({
            "@context": context,
            type,
            actor,
            object,
        });
        expect(
            validateActivityStreamResponse(
                result({
                    type: "delivery",
                    status: "retry",
                    httpStatus: 429,
                    retryAfter: 30,
                }) as never,
            ),
        ).toEqual("");
        expect(
            validateActivityStreamResponse(
                result({ type: "schedule", pending: 3 }, "schedule") as never,
            ),
        ).toEqual("");
        expect(
            validateActivityStreamResponse(
                result({ type: "delivery", status: "sent" }) as never,
            ),
        ).not.toEqual("");
        expect(
            validateActivityStreamResponse({
                ...result({ type: "delivery", status: "accepted" }),
                target,
            } as never),
        ).not.toEqual("");
    });
});
