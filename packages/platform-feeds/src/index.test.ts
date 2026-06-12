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
    datesEqual,
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

describe("datesEqual", () => {
    test("treats two null/undefined as equal", () => {
        expect(datesEqual(null, undefined)).toBe(true);
        expect(datesEqual(undefined, null)).toBe(true);
    });

    test("treats one nullish and one defined as unequal", () => {
        expect(datesEqual(null, new Date())).toBe(false);
        expect(datesEqual("2024-01-01T00:00:00Z", undefined)).toBe(false);
    });

    test("compares Date instances by getTime (preserves ms)", () => {
        const a = new Date("2024-01-01T00:00:00.123Z");
        const b = new Date("2024-01-01T00:00:00.123Z");
        const c = new Date("2024-01-01T00:00:00.456Z");
        expect(datesEqual(a, b)).toBe(true);
        expect(datesEqual(a, c)).toBe(false);
    });

    test("compares string and Date pointing to same instant as equal", () => {
        const iso = "2024-01-01T00:00:00.000Z";
        expect(datesEqual(iso, new Date(iso))).toBe(true);
    });

    test("falls back to string equality when both are unparseable", () => {
        expect(datesEqual("not-a-date", "not-a-date")).toBe(true);
        expect(datesEqual("not-a-date", "other-junk")).toBe(false);
    });
});

describe("buildFeedItem", () => {
    const channelUrl = "http://example.com/feed.xml";
    const baseItem: Parameters<typeof buildFeedItem>[0] = {
        title: "Item",
        description: "Body",
        summary: "Body",
        meta: {
            title: "Feed",
            description: "",
            language: "en",
            author: { name: "Author" },
            summary: "",
            type: "rss",
            owner: { name: "Owner", email: "owner@example.com" },
            image: { url: "", link: "", title: "" },
            explicit: false,
            lastBuildDate: "2024-01-01T00:00:00.000Z",
            pubDate: "2024-01-01T00:00:00.000Z",
            link: "http://example.com/feed",
            links: [],
        },
        pubDate: "2024-01-01T00:00:00.000Z",
        date: "2024-01-01T00:00:00.000Z",
        categories: [],
        media: [],
        source: "feed-source",
        author: "Author",
        episodeType: undefined,
        guid: "guid-1",
        duration: 0,
        enclosure: undefined,
        link: "http://example.com/item",
    } as Parameters<typeof buildFeedItem>[0];

    test("omits updated when pubDate and date represent the same instant", () => {
        const result = buildFeedItem(
            {
                ...baseItem,
                date: new Date("2024-01-01T00:00:00.000Z") as unknown as string,
            },
            channelUrl,
        );

        expect(result.published).toEqual("2024-01-01T00:00:00.000Z");
        expect(result.updated).toBeUndefined();
    });

    test("preserves updated when pubDate and date differ", () => {
        const result = buildFeedItem(
            {
                ...baseItem,
                date: "2024-01-01T00:00:01.000Z",
            },
            channelUrl,
        );

        expect(result.updated).toEqual("2024-01-01T00:00:01.000Z");
    });

    test("falls back to channel URL when item has no link or meta", () => {
        const { meta: _meta, link: _link, ...withoutLink } = baseItem;
        const result = buildFeedItem(
            withoutLink as Parameters<typeof buildFeedItem>[0],
            channelUrl,
        );

        expect(result.url).toEqual(channelUrl);
        expect(result.id).toEqual("guid-1");
    });

    test("uses epoch timestamp in stable id when pubDate is Unix epoch", () => {
        const epoch = "1970-01-01T00:00:00.000Z";
        const { meta: _meta, link: _link, guid: _guid, ...withoutLinkOrGuid } =
            baseItem;
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
                    buildFeedItem(
                        episode as Parameters<typeof buildFeedItem>[0],
                        fixture.channelUrl,
                    ),
                ).not.toThrow();
            }

            if (fixture.expectedCount > 0) {
                const results = feed.episodes.map((episode) =>
                    buildFeedItem(
                        episode as Parameters<typeof buildFeedItem>[0],
                        fixture.channelUrl,
                    ),
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
                date: randomPick([undefined, "2024-01-02T00:00:00.000Z"]),
                meta: randomPick([
                    undefined,
                    { link: "https://example.com/feed" },
                ]),
                categories: randomPick([undefined, [], ["news"]]),
                media: randomPick([undefined, []]),
                source: randomPick([undefined, "source"]),
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

    test("fetches expected feed", () => {
        platform.fetch(
            {
                id: "an id",
                actor: {
                    id: "some url",
                },
            },
            (err, results: ASCollection) => {
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
                    updated: undefined,
                    datenum: 1569456000000,
                    tags: undefined,
                    media: undefined,
                    source: undefined,
                });
            },
        );
    });

    test("handles empty feed gracefully", () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(
                '<rss><channel><title>Empty Feed</title></channel></rss>',
            );
        };

        platform.fetch(
            {
                id: "empty-feed-id",
                actor: {
                    id: "http://example.com/empty.xml",
                },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.type).toEqual("collection");
                expect(results.totalItems).toEqual(0);
                expect(results.items).toEqual([]);
                expect(results.summary).toEqual("Unknown Feed");
            },
        );
    });

    test("handles feed items without per-entry link", () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(loadFixture("no-link-rss.xml"));
        };

        platform.fetch(
            {
                id: "no-link-item-id",
                actor: {
                    id: "http://example.com/feed.xml",
                },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.totalItems).toEqual(1);
                expect(results.items[0].object?.url).toEqual(
                    "http://example.com/feed.xml",
                );
            },
        );
    });

    test("handles regression podcast feed without per-entry link or meta", () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(loadFixture("no-link-no-meta-rss.xml"));
        };

        platform.fetch(
            {
                id: "regression-feed-id",
                actor: {
                    id: "https://example.com/podcast",
                },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.totalItems).toEqual(2);
                for (const item of results.items) {
                    expect(item.object?.url).toEqual(
                        "https://example.com/podcast",
                    );
                    expect(typeof item.object?.id).toBe("string");
                }
            },
        );
    });

    test("handles feed with no actor name", () => {
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

        platform.fetch(
            {
                id: "no-name-feed-id",
                actor: {
                    id: "http://example.com/noname.xml",
                },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.summary).toEqual("http://example.com/noname.xml");
            },
        );
    });

    test("handles network errors properly", () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.reject(new Error("Network timeout"));
        };

        platform.fetch(
            {
                id: "error-test-id",
                actor: {
                    id: "http://example.com/timeout.xml",
                },
            },
            (err, results: ASCollection) => {
                expect(err).toBeInstanceOf(Error);
                expect(err?.message).toEqual("Network timeout");
                expect(results).toBeUndefined();
            },
        );
    });

    it("emits a schema-valid collection from a real channel image/author feed", () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(loadFixture("channel-image-author-rss.xml"));
        };

        platform.fetch(
            {
                id: "image-author-feed-id",
                actor: {
                    id: "https://example.com/feed",
                },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.totalItems).toEqual(1);

                // The real buildFeedChannel output (image + author) and the
                // per-post `id` must satisfy the strict outbound schema.
                const actor = results.items[0].actor;
                expect(typeof actor?.image).toBe("string");
                expect(actor?.image).toEqual("https://example.com/logo.png");
                // podparse maps <author> to the raw text, not an object.
                expect(actor?.author).toEqual(
                    "editor@example.com (Jane Editor)",
                );
                expect(results.items[0].id).toEqual("image-author-feed-id");

                expect(validateActivityStreamResponse(results)).toEqual("");
            },
        );
    });

    it("emits a schema-valid collection from a feed without channel image/author", () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(loadFixture("bare-channel-rss.xml"));
        };

        platform.fetch(
            {
                id: "bare-feed-id",
                actor: {
                    id: "https://example.com/feed",
                },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.totalItems).toEqual(1);

                // Absent channel metadata must not break strict validation:
                // image/author are undefined and AJV skips undefined-valued
                // properties (they are also dropped at the JSON/IPC boundary).
                const actor = results.items[0].actor;
                expect(actor?.image).toBeUndefined();
                expect(actor?.author).toBeUndefined();

                expect(validateActivityStreamResponse(results)).toEqual("");
                expect(
                    validateActivityStreamResponse(
                        JSON.parse(JSON.stringify(results)),
                    ),
                ).toEqual("");
            },
        );
    });

    test("validates collection structure matches ASCollection interface", () => {
        platform.fetch(
            {
                id: "validation-test-id",
                actor: {
                    id: "some url",
                },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();

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
            },
        );
    });

    it("limit caps the number of returned entries", () => {
        platform.fetch(
            { id: "limit-id", actor: { id: "some url" }, object: { limit: 5 } },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.totalItems).toEqual(5);
                expect(results.items.length).toEqual(5);
            },
        );
    });

    it("since in the future filters out all entries", () => {
        platform.fetch(
            {
                id: "since-future-id",
                actor: { id: "some url" },
                object: { since: "2999-01-01T00:00:00.000Z" },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.totalItems).toEqual(0);
            },
        );
    });

    it("since at the epoch keeps every entry", () => {
        platform.fetch(
            {
                id: "since-epoch-id",
                actor: { id: "some url" },
                object: { since: "1970-01-01T00:00:00.000Z" },
            },
            (err, results: ASCollection) => {
                expect(err).toBeNull();
                expect(results.totalItems).toEqual(20);
            },
        );
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
