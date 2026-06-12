import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, test } from "bun:test";
import type { ASCollection, PlatformSession } from "@sockethub/schemas";
import type { ActivityStream } from "@sockethub/schemas";
import {
    addPlatformContext,
    addPlatformSchema,
    validateActivityStream,
    validateActivityStreamResponse,
} from "@sockethub/schemas";
import getPodcastFromFeed from "podparse";
import feedsSchema from "./schema";
import { RSSFeed } from "./index.test.data";
import Feeds, {
    applyFetchFilters,
    buildFeedItem,
    extractFetchParams,
    type FeedFetchParams,
} from "./index";

addPlatformSchema(feedsSchema.messages, "feeds/messages");
addPlatformSchema(feedsSchema.responses, "feeds/responses");
addPlatformContext("feeds", feedsSchema.contextUrl);

// Wrap feed-item objects exactly as the feeds platform emits them: a single
// `collection` message whose `items` are `post` entries. Used to validate real
// parsed output against the strict outbound `responses` schema.
function buildCollection(objects: Array<ReturnType<typeof buildFeedItem>>) {
    return {
        "@context": [feedsSchema.contextUrl],
        type: "collection",
        summary: "Test Feed",
        totalItems: objects.length,
        items: objects.map((object) => ({
            "@context": [feedsSchema.contextUrl],
            type: "post",
            actor: {
                id: "https://example.com/feed",
                type: "feed",
                name: "Example",
                link: "https://example.com",
                categories: [],
            },
            object,
        })),
    };
}

const FIXTURES_DIR = path.join(import.meta.dirname, "../test/fixtures");

function loadFixture(name: string): string {
    return readFileSync(path.join(FIXTURES_DIR, name), "utf8");
}

describe("inbound messages schema", () => {
    function fetchMsg(object?: Record<string, unknown>): ActivityStream {
        return {
            "@context": [
                "https://www.w3.org/ns/activitystreams",
                "https://sockethub.org/ns/context/v1.jsonld",
                feedsSchema.contextUrl,
            ],
            type: "fetch",
            actor: {
                id: "https://example.com/feed.xml",
                type: "feed",
            },
            ...(object ? { object } : {}),
        } as unknown as ActivityStream;
    }

    it("validates a fetch with no object (the common case)", () => {
        expect(validateActivityStream(fetchMsg())).toEqual("");
    });

    it("validates a fetch carrying since and limit parameters", () => {
        expect(
            validateActivityStream(
                fetchMsg({ since: "2024-01-01T00:00:00.000Z", limit: 10 }),
            ),
        ).toEqual("");
    });

    it("rejects an unknown parameter on the object", () => {
        expect(
            validateActivityStream(fetchMsg({ url: "https://example.com" })),
        ).not.toEqual("");
    });

    it("rejects a non-integer or out-of-range limit", () => {
        expect(validateActivityStream(fetchMsg({ limit: 0 }))).not.toEqual("");
        expect(validateActivityStream(fetchMsg({ limit: 1.5 }))).not.toEqual(
            "",
        );
    });

    it("rejects a since that is not an RFC3339 date-time", () => {
        expect(
            validateActivityStream(fetchMsg({ since: "last tuesday" })),
        ).not.toEqual("");
    });

    it("has no permissive additionalProperties hole on object", () => {
        expect(feedsSchema.messages.properties.object).not.toHaveProperty(
            "oneOf",
        );
        expect(
            feedsSchema.messages.properties.object.additionalProperties,
        ).toBe(false);
        expect(feedsSchema.messages).not.toHaveProperty("definitions");
    });
});

describe("buildFeedItem", () => {
    const channelUrl = "http://example.com/feed.xml";
    const baseItem: Parameters<typeof buildFeedItem>[0] = {
        title: "Item",
        description: "Body",
        summary: "Body",
        pubDate: "2024-01-01T00:00:00.000Z",
        author: "Author",
        episodeType: undefined,
        guid: "guid-1",
        duration: 0,
        enclosure: undefined,
        link: "http://example.com/item",
    } as Parameters<typeof buildFeedItem>[0];

    it("uses item published date", () => {
        const result = buildFeedItem(baseItem, channelUrl);

        expect(result.published).toEqual("2024-01-01T00:00:00.000Z");
    });

    it("falls back to channel URL when item has no link", () => {
        const { link: _link, ...withoutLink } = baseItem;
        const result = buildFeedItem(
            withoutLink as Parameters<typeof buildFeedItem>[0],
            channelUrl,
        );

        expect(result.url).toEqual(channelUrl);
        expect(result.id).toEqual("guid-1");
    });

    test("uses epoch timestamp in stable id when pubDate is Unix epoch", () => {
        const epoch = "1970-01-01T00:00:00.000Z";
        const { link: _link, guid: _guid, ...withoutLinkOrGuid } = baseItem;
        const result = buildFeedItem(
            {
                ...withoutLinkOrGuid,
                pubDate: epoch,
            } as Parameters<typeof buildFeedItem>[0],
            channelUrl,
        );

        expect(result.datenum).toEqual(0);
        expect(result.id).toEqual(`${channelUrl}#0`);
    });
});

describe("feed fixture matrix", () => {
    const fixtures = [
        {
            file: "complete-rss.xml",
            channelUrl: "https://example.com/feed",
            expectedCount: 2,
            assertItems: (results: Array<ReturnType<typeof buildFeedItem>>) => {
                const linked = results.find((r) => r.title === "Linked Article");
                expect(linked?.url).toEqual("https://example.com/articles/linked");
                expect(linked?.id).toEqual("https://example.com/articles/linked");
            },
        },
        {
            file: "no-link-rss.xml",
            channelUrl: "https://example.com/feed.xml",
            expectedCount: 1,
            assertItems: (results: Array<ReturnType<typeof buildFeedItem>>) => {
                expect(results[0]?.url).toEqual("https://example.com/feed.xml");
                expect(results[0]?.id).toEqual("entry-without-link");
            },
        },
        {
            file: "no-link-no-meta-rss.xml",
            channelUrl: "https://example.com/podcast",
            expectedCount: 2,
            assertItems: (results: Array<ReturnType<typeof buildFeedItem>>) => {
                const episode = results.find((r) => r.title === "Episode 1");
                expect(episode?.url).toEqual("https://example.com/podcast");
                expect(episode?.id).toEqual("episode-1-guid");
            },
        },
        {
            file: "empty-rss.xml",
            channelUrl: "https://example.com/empty.xml",
            expectedCount: 0,
            assertItems: () => {},
        },
    ] as const;

    for (const fixture of fixtures) {
        test(`parses ${fixture.file} through podparse and buildFeedItem`, () => {
            const feed = getPodcastFromFeed(loadFixture(fixture.file));
            expect(feed.episodes).toHaveLength(fixture.expectedCount);

            for (const episode of feed.episodes) {
                expect(() =>
                    buildFeedItem(episode, fixture.channelUrl),
                ).not.toThrow();
            }

            if (fixture.expectedCount > 0) {
                const results = feed.episodes.map((episode) =>
                    buildFeedItem(episode, fixture.channelUrl),
                );
                fixture.assertItems(results);
                // Real parsed output must satisfy the strict outbound schema.
                expect(
                    validateActivityStreamResponse(buildCollection(results)),
                ).toEqual("");
            }
        });
    }

    test("rejects a collection whose item object has an unknown type", () => {
        const items = [
            {
                type: "article",
                title: "t",
                id: "id-1",
                content: "c",
                contentType: "text",
                url: "https://example.com/a",
                datenum: 0,
                bogusField: "nope", // not in the strict feedItem schema
            },
        ] as unknown as Array<ReturnType<typeof buildFeedItem>>;
        expect(
            validateActivityStreamResponse(buildCollection(items)),
        ).not.toEqual("");
    });

    test("builds atom-like entries without per-entry link via buildFeedItem", () => {
        const result = buildFeedItem(
            {
                title: "Atom entry without link",
                description: "Atom content text",
                summary: "Atom summary text",
                pubDate: "2024-01-01T00:00:00.000Z",
                guid: "urn:uuid:atom-entry-1",
            } as Parameters<typeof buildFeedItem>[0],
            "https://example.com/atom",
        );

        expect(result.url).toEqual("https://example.com/atom");
        expect(result.id).toEqual("urn:uuid:atom-entry-1");
    });
});

describe("buildFeedItem fuzz", () => {
    const channelUrl = "https://example.com/channel";

    function randomPick<T>(values: Array<T | undefined>): T | undefined {
        return values[Math.floor(Math.random() * values.length)];
    }

    test("does not throw on random partial episode shapes", () => {
        for (let i = 0; i < 200; i++) {
            const partial = {
                title: randomPick([undefined, "", "Title", "Episode"]),
                description: randomPick([undefined, "", "x".repeat(300), "short"]),
                summary: randomPick([undefined, "", "summary"]),
                link: randomPick([
                    undefined,
                    "",
                    "https://example.com/item",
                ]),
                guid: randomPick([undefined, "", "guid-123", 456]),
                pubDate: randomPick([
                    undefined,
                    "",
                    "2024-01-01T00:00:00.000Z",
                    new Date("2024-01-01"),
                ]),
            };

            expect(() =>
                buildFeedItem(
                    partial as Parameters<typeof buildFeedItem>[0],
                    channelUrl,
                ),
            ).not.toThrow();
        }
    });
});

describe("platform-feeds", () => {
    let platform: Feeds & { makeRequest: (url: string) => Promise<string> };

    beforeEach(() => {
        platform = new Feeds({
            log: {
                error: () => {},
                warn: () => {},
                info: () => {},
                debug: () => {},
            },
        } as unknown as PlatformSession) as Feeds & {
            makeRequest: (url: string) => Promise<string>;
        };

        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(RSSFeed);
        };
    });

    // Promisify platform.fetch so tests await its completion. With the bare
    // callback style the test body returns before the callback fires, and
    // assertion failures escape as unhandled rejections instead of failing
    // the test.
    function fetchCollection(
        job: Parameters<Feeds["fetch"]>[0],
    ): Promise<ASCollection> {
        return new Promise((resolve, reject) => {
            platform.fetch(job, (err, results: ASCollection) => {
                if (err) {
                    reject(err instanceof Error ? err : new Error(String(err)));
                } else {
                    resolve(results);
                }
            });
        });
    }

    it("fetches expected feed", async () => {
        const results = await fetchCollection({
            id: "an id",
            actor: {
                id: "some url",
            },
        });
        expect(results.totalItems).toEqual(20);
        expect(results.items[5].object).toEqual({
            type: "article",
            title: "Sockethub 3.x",
            id: "https://sockethub.org/news/2019-09-26-3x.html",
            brief: undefined,
            content:
                "<p>Sockethub 3.0 has been released and includes a lot of improvements focusing mainly on XMPP and IRC, additionally a ton of internal improvements. Ongoing releases tracked on the <a href=\"https://github.com/sockethub/sockethub/releases\">Github page</a>. </p>",
            contentType: "html",
            url: "https://sockethub.org/news/2019-09-26-3x.html",
            published: "2019-09-26T00:00:00.000Z",
            datenum: 1569456000000,
        });
    });

    it("handles empty feed gracefully", async () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(
                '<rss><channel><title>Empty Feed</title></channel></rss>',
            );
        };

        const results = await fetchCollection({
            id: "empty-feed-id",
            actor: {
                id: "http://example.com/empty.xml",
            },
        });
        expect(results.type).toEqual("collection");
        expect(results.totalItems).toEqual(0);
        expect(results.items).toEqual([]);
        expect(results.summary).toEqual("Unknown Feed");
    });

    it("handles feed items without per-entry link", async () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(loadFixture("no-link-rss.xml"));
        };

        const results = await fetchCollection({
            id: "no-link-item-id",
            actor: {
                id: "http://example.com/feed.xml",
            },
        });
        expect(results.totalItems).toEqual(1);
        expect(results.items[0].object?.url).toEqual(
            "http://example.com/feed.xml",
        );
    });

    it("handles regression podcast feed without per-entry link or meta", async () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(loadFixture("no-link-no-meta-rss.xml"));
        };

        const results = await fetchCollection({
            id: "regression-feed-id",
            actor: {
                id: "https://example.com/podcast",
            },
        });
        expect(results.totalItems).toEqual(2);
        for (const item of results.items) {
            expect(item.object?.url).toEqual("https://example.com/podcast");
            expect(typeof item.object?.id).toBe("string");
        }
    });

    it("handles feed with no actor name", async () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(`
                <rss>
                    <channel>
                        <item>
                            <title>Test Item</title>
                            <description>Test content</description>
                            <link>http://example.com/item</link>
                            <pubDate>Thu, 01 Jan 2024 00:00:00 GMT</pubDate>
                        </item>
                    </channel>
                </rss>
            `);
        };

        const results = await fetchCollection({
            id: "no-name-feed-id",
            actor: {
                id: "http://example.com/noname.xml",
            },
        });
        expect(results.summary).toEqual("http://example.com/noname.xml");
    });

    it("handles network errors properly", async () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.reject(new Error("Network timeout"));
        };

        await expect(
            fetchCollection({
                id: "error-test-id",
                actor: {
                    id: "http://example.com/timeout.xml",
                },
            }),
        ).rejects.toThrow("Network timeout");
    });

    it("emits a schema-valid collection from a real channel image/author feed", async () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(loadFixture("channel-image-author-rss.xml"));
        };

        const results = await fetchCollection({
            id: "image-author-feed-id",
            actor: {
                id: "https://example.com/feed",
            },
        });
        expect(results.totalItems).toEqual(1);

        // The real buildFeedChannel output (image + author) and the
        // per-post `id` must satisfy the strict outbound schema.
        const actor = results.items[0].actor;
        expect(typeof actor?.image).toBe("string");
        expect(actor?.image).toEqual("https://example.com/logo.png");
        // podparse maps <author> to the raw text, not an object.
        expect(actor?.author).toEqual("editor@example.com (Jane Editor)");
        expect(results.items[0].id).toEqual("image-author-feed-id");

        expect(validateActivityStreamResponse(results)).toEqual("");
    });

    it("emits a schema-valid collection from a feed without channel image/author", async () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(loadFixture("bare-channel-rss.xml"));
        };

        const results = await fetchCollection({
            id: "bare-feed-id",
            actor: {
                id: "https://example.com/feed",
            },
        });
        expect(results.totalItems).toEqual(1);

        // Absent channel metadata must not break strict validation:
        // image/author are undefined and AJV skips undefined-valued
        // properties (they are also dropped at the JSON/IPC boundary).
        const actor = results.items[0].actor;
        expect(actor?.image).toBeUndefined();
        expect(actor?.author).toBeUndefined();

        expect(validateActivityStreamResponse(results)).toEqual("");
        expect(
            validateActivityStreamResponse(JSON.parse(JSON.stringify(results))),
        ).toEqual("");
    });

    it("validates collection structure matches ASCollection interface", async () => {
        const results = await fetchCollection({
            id: "validation-test-id",
            actor: {
                id: "some url",
            },
        });
        expect(results).toHaveProperty("@context");
        expect(results).toHaveProperty("type", "collection");
        expect(results).toHaveProperty("summary");
        expect(results).toHaveProperty("totalItems");
        expect(results).toHaveProperty("items");

        expect(Array.isArray(results["@context"])).toBe(true);
        expect(typeof results.summary).toBe("string");
        expect(typeof results.totalItems).toBe("number");
        expect(Array.isArray(results.items)).toBe(true);

        expect(results.items.length).toEqual(results.totalItems);
    });

    it("limit caps the number of returned entries", async () => {
        const results = await fetchCollection({
            id: "limit-id",
            actor: { id: "some url" },
            object: { limit: 5 },
        });
        expect(results.totalItems).toEqual(5);
        expect(results.items.length).toEqual(5);
    });

    it("since in the future filters out all entries", async () => {
        const results = await fetchCollection({
            id: "since-future-id",
            actor: { id: "some url" },
            object: { since: "2999-01-01T00:00:00.000Z" },
        });
        expect(results.totalItems).toEqual(0);
    });

    it("since at the epoch keeps every entry", async () => {
        const results = await fetchCollection({
            id: "since-epoch-id",
            actor: { id: "some url" },
            object: { since: "1970-01-01T00:00:00.000Z" },
        });
        expect(results.totalItems).toEqual(20);
    });
});

describe("extractFetchParams", () => {
    it("returns empty params for missing or non-object input", () => {
        expect(extractFetchParams(undefined)).toEqual({});
        expect(extractFetchParams(null)).toEqual({});
        expect(extractFetchParams("nope")).toEqual({});
    });

    it("reads since and a valid integer limit", () => {
        expect(
            extractFetchParams({ since: "2024-01-01T00:00:00.000Z", limit: 3 }),
        ).toEqual({ since: "2024-01-01T00:00:00.000Z", limit: 3 });
    });

    it("ignores a non-integer or out-of-range limit", () => {
        expect(extractFetchParams({ limit: 0 })).toEqual({});
        expect(extractFetchParams({ limit: 2.5 })).toEqual({});
        expect(extractFetchParams({ limit: "5" })).toEqual({});
    });
});

describe("applyFetchFilters", () => {
    function article(
        datenum: number,
    ): Parameters<typeof applyFetchFilters>[0][number] {
        return {
            "@context": [feedsSchema.contextUrl],
            type: "post",
            actor: { id: "a", type: "feed", name: "n", link: "l" },
            object: { datenum },
        } as unknown as Parameters<typeof applyFetchFilters>[0][number];
    }

    const articles = [article(300), article(200), article(100), article(0)];

    it("returns all entries when no params are given", () => {
        expect(applyFetchFilters(articles, {}).length).toEqual(4);
    });

    it("drops entries published before since (undated excluded)", () => {
        const result = applyFetchFilters(articles, { since: new Date(150).toISOString() });
        expect(result.map((a) => a.object?.datenum)).toEqual([300, 200]);
    });

    it("preserves feed order and caps at limit", () => {
        const result = applyFetchFilters(articles, { limit: 2 });
        expect(result.map((a) => a.object?.datenum)).toEqual([300, 200]);
    });

    it("applies since before limit", () => {
        const params: FeedFetchParams = {
            since: new Date(50).toISOString(),
            limit: 2,
        };
        const result = applyFetchFilters(articles, params);
        expect(result.map((a) => a.object?.datenum)).toEqual([300, 200]);
    });

    it("ignores an unparseable since", () => {
        expect(applyFetchFilters(articles, { since: "garbage" }).length).toEqual(
            4,
        );
    });

    it("excludes undated entries even when since is the epoch", () => {
        const result = applyFetchFilters(articles, {
            since: "1970-01-01T00:00:00.000Z",
        });
        expect(result.map((a) => a.object?.datenum)).toEqual([300, 200, 100]);
    });
});
