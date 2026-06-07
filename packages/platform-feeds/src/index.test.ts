import { beforeEach, describe, expect, it } from "bun:test";
import { RSSFeed} from "./index.test.data";
import Feeds, { buildFeedItem, datesEqual } from "./index";
import { ASCollection, PlatformSession } from "@sockethub/schemas";

describe("datesEqual", () => {
    it("treats two null/undefined as equal", () => {
        expect(datesEqual(null, undefined)).toBe(true);
        expect(datesEqual(undefined, null)).toBe(true);
    });

    it("treats one nullish and one defined as unequal", () => {
        expect(datesEqual(null, new Date())).toBe(false);
        expect(datesEqual("2024-01-01T00:00:00Z", undefined)).toBe(false);
    });

    it("compares Date instances by getTime (preserves ms)", () => {
        const a = new Date("2024-01-01T00:00:00.123Z");
        const b = new Date("2024-01-01T00:00:00.123Z");
        const c = new Date("2024-01-01T00:00:00.456Z");
        expect(datesEqual(a, b)).toBe(true);
        expect(datesEqual(a, c)).toBe(false);
    });

    it("compares string and Date pointing to same instant as equal", () => {
        const iso = "2024-01-01T00:00:00.000Z";
        expect(datesEqual(iso, new Date(iso))).toBe(true);
    });

    it("falls back to string equality when both are unparseable", () => {
        expect(datesEqual("not-a-date", "not-a-date")).toBe(true);
        expect(datesEqual("not-a-date", "other-junk")).toBe(false);
    });
});

describe("buildFeedItem", () => {
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

    it("omits updated when pubDate and date represent the same instant", () => {
        const result = buildFeedItem(
            {
                ...baseItem,
                date: new Date("2024-01-01T00:00:00.000Z") as unknown as string,
            },
            "http://example.com/feed",
        );

        expect(result.published).toEqual("2024-01-01T00:00:00.000Z");
        expect(result.updated).toBeUndefined();
    });

    it("preserves updated when pubDate and date differ", () => {
        const result = buildFeedItem(
            {
                ...baseItem,
                date: "2024-01-01T00:00:01.000Z",
            },
            "http://example.com/feed",
        );

        expect(result.updated).toEqual("2024-01-01T00:00:01.000Z");
    });

    it("falls back to channel URL when item has no link or meta", () => {
        const { meta: _meta, link: _link, ...withoutLink } = baseItem;
        const result = buildFeedItem(
            withoutLink as Parameters<typeof buildFeedItem>[0],
            "http://example.com/feed.xml",
        );

        expect(result.url).toEqual("http://example.com/feed.xml");
        expect(result.id).toEqual("guid-1");
    });
});

describe("platform-feeds", () => {
    let platform;
    beforeEach(() => {
        platform = new Feeds({
            log: {
                error: () => {},
                warn: () => {},
                info: () => {},
                debug: () => {},
            }
        } as unknown as PlatformSession);

        platform.makeRequest = (
            url: string,
        ): Promise<string> => {
            return Promise.resolve(RSSFeed);
        };
    });

    it("fetches expected feed", () => {
        platform.fetch({
            id: "an id",
            actor: {
                id: "some url"
            }
        }, (err, results: ASCollection) => {
            expect(results['totalItems']).toEqual(20);
            expect(results['items'][5]['object']).toEqual({
                type: "article",
                title: "Sockethub 3.x",
                id: "https://sockethub.org/news/2019-09-26-3x.html",
                brief: undefined,
                content: "<p>Sockethub 3.0 has been released and includes a lot of improvements focusing mainly on XMPP and IRC, additionally a ton of internal improvements. Ongoing releases tracked on the <a href=\"https://github.com/sockethub/sockethub/releases\">Github page</a>. </p>",
                contentType: "html",
                url: "https://sockethub.org/news/2019-09-26-3x.html",
                published: "2019-09-26T00:00:00.000Z",
                updated: undefined,
                datenum: 1569456000000,
                tags: undefined,
                media: undefined,
                source: undefined,
            })
        })
    })

    it("handles empty feed gracefully", () => {
        // Mock empty feed
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve('<rss><channel><title>Empty Feed</title></channel></rss>');
        };

        platform.fetch({
            id: "empty-feed-id",
            actor: {
                id: "http://example.com/empty.xml"
            }
        }, (err, results: ASCollection) => {
            expect(err).toBeNull();
            expect(results.type).toEqual("collection");
            expect(results.totalItems).toEqual(0);
            expect(results.items).toEqual([]);
            expect(results.summary).toEqual("Unknown Feed");
        })
    })

    it("handles feed items without per-entry link", () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.resolve(`
                <rss>
                    <channel>
                        <title>Test Feed</title>
                        <link>http://example.com/feed.xml</link>
                        <item>
                            <title>Entry without link</title>
                            <description>Body text</description>
                            <guid>entry-without-link</guid>
                            <pubDate>Thu, 01 Jan 2024 00:00:00 GMT</pubDate>
                        </item>
                    </channel>
                </rss>
            `);
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

    it("handles feed with no actor name", () => {
        // Mock feed with no title/name but proper structure
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

        platform.fetch({
            id: "no-name-feed-id", 
            actor: {
                id: "http://example.com/noname.xml"
            }
        }, (err, results: ASCollection) => {
            expect(err).toBeNull();
            // When no title is provided, buildFeedChannel falls back to URL
            expect(results.summary).toEqual("http://example.com/noname.xml");
        })
    })

    it("handles network errors properly", () => {
        platform.makeRequest = (): Promise<string> => {
            return Promise.reject(new Error("Network timeout"));
        };

        platform.fetch({
            id: "error-test-id",
            actor: {
                id: "http://example.com/timeout.xml"
            }
        }, (err, results: ASCollection) => {
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toEqual("Network timeout");
            expect(results).toBeUndefined();
        })
    })

    it("validates collection structure matches ASCollection interface", () => {
        platform.fetch({
            id: "validation-test-id",
            actor: {
                id: "some url"
            }
        }, (err, results: ASCollection) => {
            expect(err).toBeNull();
            
            // Validate required ASCollection properties
            expect(results).toHaveProperty("@context");
            expect(results).toHaveProperty("type", "collection");
            expect(results).toHaveProperty("summary");
            expect(results).toHaveProperty("totalItems");
            expect(results).toHaveProperty("items");
            
            // Validate types
            expect(Array.isArray(results["@context"])).toBe(true);
            expect(typeof results.summary).toBe("string");
            expect(typeof results.totalItems).toBe("number");
            expect(Array.isArray(results.items)).toBe(true);
            
            // Validate collection consistency
            expect(results.items.length).toEqual(results.totalItems);
        })
    })
})
