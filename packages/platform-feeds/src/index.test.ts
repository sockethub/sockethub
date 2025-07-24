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
})
