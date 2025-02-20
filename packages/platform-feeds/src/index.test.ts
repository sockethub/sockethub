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
            target: {
                id: "some url"
            }
        }, (err, results: ASCollection) => {
            expect(results.totalItems).toEqual(10);
            expect(results.items[5].actor.name).toEqual("sub-fish");
        })
    })
})
