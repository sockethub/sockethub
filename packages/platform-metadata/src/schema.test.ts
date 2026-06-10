import { describe, expect, mock, test } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
import { PlatformMetadataSchema } from "./schema";

addPlatformSchema(PlatformMetadataSchema.responses, "metadata/responses");
addPlatformContext("metadata", PlatformMetadataSchema.contextUrl);

const CTX = [PlatformMetadataSchema.contextUrl];

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
