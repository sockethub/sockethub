import { beforeEach, describe, expect, it } from "bun:test";
import { RSSFeed} from "./index.test.data";
import Feeds from "./index";
import { ASCollection, PlatformSession } from "@sockethub/schemas";
import debug from "debug";

describe("platform-feeds", () => {
    let platform;
    beforeEach(() => {
        platform = new Feeds({
            debug: debug("sockethub:platform:feeds")
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
            expect(results).toHaveProperty("context");
            expect(results).toHaveProperty("type", "collection");
            expect(results).toHaveProperty("summary");
            expect(results).toHaveProperty("totalItems");
            expect(results).toHaveProperty("items");
            
            // Validate types
            expect(typeof results.context).toBe("string");
            expect(typeof results.summary).toBe("string");
            expect(typeof results.totalItems).toBe("number");
            expect(Array.isArray(results.items)).toBe(true);
            
            // Validate collection consistency
            expect(results.items.length).toEqual(results.totalItems);
        })
    })
})
