import { describe, expect, it, mock, test } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    validateActivityStream,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
import { PlatformMetadataSchema } from "./schema";

addPlatformSchema(PlatformMetadataSchema.responses, "metadata/responses");
addPlatformSchema(PlatformMetadataSchema.messages, "metadata/messages");
addPlatformContext("metadata", PlatformMetadataSchema.contextUrl);

const CTX = [PlatformMetadataSchema.contextUrl];
// Full envelope context required by the base activity-stream schema (exactly
// three entries) for inbound message validation.
const MSG_CTX = [
    "https://www.w3.org/ns/activitystreams",
    "https://sockethub.org/ns/context/v1.jsonld",
    PlatformMetadataSchema.contextUrl,
];

// Mock open-graph-scraper so we exercise the platform's real fetch() output
// path against the strict responses schema, without network access.
let ogResult: Record<string, unknown> = {};
mock.module("open-graph-scraper", () => ({
    default: async () => ({ result: ogResult }),
}));

const { default: Metadata } = await import("./index");
// biome-ignore lint/suspicious/noExplicitAny: minimal fake session
const platform = new Metadata({ log: { debug() {} } } as any);

// Run the real fetch() handler with a given open-graph-scraper result and
// return the produced message as the server would see it (post-IPC: a JSON
// round-trip drops `undefined`-valued keys).
function runFetch(result: Record<string, unknown>): Promise<unknown> {
    ogResult = result;
    const job = {
        "@context": CTX,
        type: "fetch",
        actor: { id: "https://example.com", type: "website" },
    };
    return new Promise((resolve) => {
        // biome-ignore lint/suspicious/noExplicitAny: test job
        platform.fetch(job as any, (_err, produced) => {
            resolve(JSON.parse(JSON.stringify(produced ?? job)));
        });
    });
}

describe("metadata responses schema", () => {
    test("real fetch() output (fully populated) passes validation", async () => {
        const produced = await runFetch({
            ogTitle: "Example",
            ogDescription: "a description",
            ogSiteName: "Example Site",
            ogLocale: "en_US",
            ogUrl: "https://example.com",
            ogImage: [
                {
                    url: "https://example.com/i.png",
                    type: "png",
                    width: "100",
                    height: "50",
                },
            ],
            favicon: "https://example.com/favicon.ico",
            charset: "utf-8",
        });
        // biome-ignore lint/suspicious/noExplicitAny: assertion
        expect(validateActivityStreamResponse(produced as any)).toEqual("");
    });

    test("real fetch() output (sparse scrape) passes validation", async () => {
        const produced = await runFetch({ ogTitle: "Only a title" });
        // biome-ignore lint/suspicious/noExplicitAny: assertion
        expect(validateActivityStreamResponse(produced as any)).toEqual("");
    });

    test("rejects an unknown field on the page object", () => {
        const msg = {
            "@context": CTX,
            type: "fetch",
            actor: { id: "https://example.com", type: "website" },
            object: { type: "page", bogus: "x" },
        };
        // biome-ignore lint/suspicious/noExplicitAny: assertion
        expect(validateActivityStreamResponse(msg as any)).not.toEqual("");
    });

    test("rejects an invalid actor type", () => {
        const msg = {
            "@context": CTX,
            type: "fetch",
            actor: { id: "https://example.com", type: "person" },
            object: { type: "page" },
        };
        // biome-ignore lint/suspicious/noExplicitAny: assertion
        expect(validateActivityStreamResponse(msg as any)).not.toEqual("");
    });
});

describe("metadata inbound messages schema", () => {
    function fetchMsg(object?: Record<string, unknown>) {
        return {
            "@context": MSG_CTX,
            type: "fetch",
            actor: { id: "https://example.com", type: "website" },
            ...(object ? { object } : {}),
        };
    }

    it("validates a fetch with only an actor (no object)", () => {
        // biome-ignore lint/suspicious/noExplicitAny: assertion
        expect(validateActivityStream(fetchMsg() as any)).toEqual("");
    });

    it("rejects a fetch carrying any inbound object", () => {
        expect(
            // biome-ignore lint/suspicious/noExplicitAny: assertion
            validateActivityStream(fetchMsg({ url: "https://example.com" }) as any),
        ).not.toEqual("");
        // biome-ignore lint/suspicious/noExplicitAny: assertion
        expect(validateActivityStream(fetchMsg({}) as any)).not.toEqual("");
    });

    it("has no permissive placeholder left on the messages schema", () => {
        expect(PlatformMetadataSchema.messages.properties.object).toBe(false);
        expect(PlatformMetadataSchema.messages).not.toHaveProperty(
            "definitions",
        );
    });
});
