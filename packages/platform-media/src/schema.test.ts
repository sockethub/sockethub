import { describe, expect, it } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    validateActivityStream,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
import { PlatformMediaSchema } from "./schema";

addPlatformSchema(PlatformMediaSchema.responses, "media/responses");
addPlatformSchema(PlatformMediaSchema.messages, "media/messages");
addPlatformContext("media", PlatformMediaSchema.contextUrl);

const MSG_CTX = [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    PlatformMediaSchema.contextUrl,
];
const actor = { id: "https://example.com/article", type: "website" };

describe("media platform schema", () => {
    it("accepts a download of an absolute or page-relative image URL", () => {
        for (const url of ["https://cdn.example.com/a.png", "/favicon.ico"]) {
            expect(
                validateActivityStream({
                    "@context": MSG_CTX,
                    type: "download",
                    actor,
                    object: { type: "image", url },
                }),
            ).toEqual("");
        }
    });

    it("rejects a download without an image object", () => {
        for (const object of [
            undefined,
            { type: "image" },
            { type: "page", url: "/a.png" },
            { type: "image", url: "/a.png", extra: true },
        ]) {
            expect(
                validateActivityStream({
                    "@context": MSG_CTX,
                    type: "download",
                    actor,
                    ...(object ? { object } : {}),
                }),
            ).not.toEqual("");
        }
    });

    it("accepts the image the platform returns", () => {
        expect(
            validateActivityStreamResponse({
                "@context": MSG_CTX,
                type: "download",
                actor,
                object: {
                    type: "image",
                    url: "https://cdn.example.com/a.png",
                    mediaType: "image/png",
                    size: 3,
                    data: "AAAA",
                },
            }),
        ).toEqual("");
    });
});
