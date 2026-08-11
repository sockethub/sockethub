import { describe, expect, it } from "bun:test";
import {
    isRedditUrl,
    normalizeDescription,
    parseRedditOEmbed,
    redditOEmbedImage,
    redditPostImages,
    resolveRedditEmbed,
    resolveTwitterStatus,
    tweetToPageObject,
} from "./resolvers";

describe("resolveTwitterStatus", () => {
    it("resolves status URLs on every X/Twitter host", () => {
        for (const host of [
            "twitter.com",
            "www.twitter.com",
            "mobile.twitter.com",
            "x.com",
            "www.x.com",
            "mobile.x.com",
        ]) {
            expect(
                resolveTwitterStatus(`https://${host}/SomeUser/status/12345`),
            ).toEqual("https://api.fxtwitter.com/status/12345");
        }
    });

    it("resolves the /i/web/status share form", () => {
        expect(
            resolveTwitterStatus("https://x.com/i/web/status/98765"),
        ).toEqual("https://api.fxtwitter.com/status/98765");
    });

    it("resolves the legacy /statuses/ path and ignores query/fragment", () => {
        expect(
            resolveTwitterStatus(
                "https://twitter.com/user_name/statuses/42?s=20#m",
            ),
        ).toEqual("https://api.fxtwitter.com/status/42");
    });

    it("ignores non-status X URLs", () => {
        expect(resolveTwitterStatus("https://x.com/SomeUser")).toBeNull();
        expect(resolveTwitterStatus("https://x.com/search?q=hi")).toBeNull();
        expect(resolveTwitterStatus("https://x.com/user/status/abc")).toBeNull();
    });

    it("ignores other hosts and invalid URLs", () => {
        expect(
            resolveTwitterStatus("https://example.com/u/status/123"),
        ).toBeNull();
        expect(
            // Lookalike suffix must not match (attacker-controlled host).
            resolveTwitterStatus("https://notx.com/u/status/123"),
        ).toBeNull();
        expect(resolveTwitterStatus("not a url")).toBeNull();
    });
});

describe("resolveRedditEmbed", () => {
    it("maps Reddit posts to the official media-enabled embed", () => {
        expect(
            resolveRedditEmbed(
                "https://www.reddit.com/r/pics/comments/abc123/title/?share=1",
            ),
        ).toEqual(
            "https://embed.reddit.com/r/pics/comments/abc123/title/?embed=true&showmedia=true",
        );
    });

    it("ignores non-post, short, lookalike, and invalid URLs", () => {
        expect(resolveRedditEmbed("https://reddit.com/r/pics")).toBeNull();
        expect(resolveRedditEmbed("https://redd.it/abc123")).toBeNull();
        expect(resolveRedditEmbed("https://notreddit.com/r/x/comments/1/x")).toBeNull();
        expect(resolveRedditEmbed("not a url")).toBeNull();
    });
});

describe("redditOEmbedImage", () => {
    it("maps a post thumbnail with its dimensions", () => {
        expect(
            redditOEmbedImage({
                thumbnail_url: "https://preview.redd.it/post.jpg",
                thumbnail_width: 640,
                thumbnail_height: 480,
            }),
        ).toEqual([
            {
                url: "https://preview.redd.it/post.jpg",
                width: 640,
                height: 480,
            },
        ]);
    });

    it("returns no image for text posts or unsafe thumbnail URLs", () => {
        expect(redditOEmbedImage({})).toBeUndefined();
        expect(
            redditOEmbedImage({ thumbnail_url: "javascript:alert(1)" }),
        ).toBeUndefined();
        expect(
            redditOEmbedImage({ thumbnail_url: "not a URL" }),
        ).toBeUndefined();
    });
});

describe("parseRedditOEmbed", () => {
    it("accepts the consumed fields and ignores valid upstream extras", () => {
        expect(
            parseRedditOEmbed({
                title: "Post",
                provider_name: "reddit",
                thumbnail_url: "https://preview.redd.it/post.png",
                thumbnail_width: 640,
                html: "<blockquote>upstream field</blockquote>",
            }),
        ).toMatchObject({ title: "Post", thumbnail_width: 640 });
    });

    it("rejects malformed external payloads", () => {
        expect(parseRedditOEmbed(null)).toBeNull();
        expect(parseRedditOEmbed([])).toBeNull();
        expect(parseRedditOEmbed({ title: 42 })).toBeNull();
        expect(parseRedditOEmbed({ thumbnail_width: -1 })).toBeNull();
        expect(parseRedditOEmbed({ thumbnail_height: Number.NaN })).toBeNull();
    });
});

describe("redditPostImages", () => {
    it("keeps post media and removes generic Reddit images", () => {
        expect(
            redditPostImages([
                { url: "https://redditstatic.com/generic-hero.png" },
                { url: "https://share.redd.it/preview/post/abc123" },
                { url: "https://preview.redd.it/post.png?width=640" },
            ]),
        ).toEqual([{ url: "https://preview.redd.it/post.png?width=640" }]);
    });
});

describe("normalizeDescription", () => {
    it("caps blank lines and normalizes horizontal whitespace", () => {
        expect(
            normalizeDescription(
                "\r\n  First\t paragraph  \r\n\r\n \r\n\r\n Second\u00a0  paragraph \r\n",
            ),
        ).toEqual("First paragraph\n\nSecond paragraph");
    });

    it("preserves meaningful line and paragraph boundaries", () => {
        expect(normalizeDescription("one\ntwo\n\nthree")).toEqual(
            "one\ntwo\n\nthree",
        );
    });
});

describe("isRedditUrl", () => {
    it("matches reddit hosts and redd.it short links", () => {
        for (const url of [
            "https://www.reddit.com/r/pics/comments/abc123/some_title/",
            "https://old.reddit.com/r/x/comments/id/",
            "https://new.reddit.com/r/x/comments/id/",
            "https://np.reddit.com/r/x/comments/id/",
            "https://reddit.com/r/x/comments/id/",
            "https://redd.it/abc123",
        ]) {
            expect(isRedditUrl(url)).toBeTrue();
        }
    });

    it("ignores other hosts and invalid URLs", () => {
        expect(isRedditUrl("https://example.com/r/pics")).toBeFalse();
        // Lookalike suffix must not match (attacker-controlled host).
        expect(isRedditUrl("https://ireddit.com/r/pics")).toBeFalse();
        expect(isRedditUrl("https://notredd.it/abc")).toBeFalse();
        expect(isRedditUrl("not a url")).toBeFalse();
    });
});

describe("tweetToPageObject", () => {
    const author = { name: "Some Person", screen_name: "someperson" };

    it("maps a photo tweet to a page with the post's own image", () => {
        const page = tweetToPageObject({
            code: 200,
            tweet: {
                url: "https://x.com/someperson/status/1",
                text: "hello world",
                author,
                media: {
                    photos: [
                        {
                            url: "https://pbs.twimg.com/media/abc.jpg?name=orig",
                            width: 800,
                            height: 532,
                        },
                    ],
                },
            },
        });
        expect(page).toEqual({
            type: "page",
            title: "Some Person (@someperson) on X",
            name: "X (formerly Twitter)",
            description: "hello world",
            url: "https://x.com/someperson/status/1",
            favicon: "https://x.com/favicon.ico",
            image: [
                {
                    url: "https://pbs.twimg.com/media/abc.jpg?name=orig",
                    width: 800,
                    height: 532,
                },
            ],
        });
    });

    it("maps a video tweet to a page with thumbnail image and video", () => {
        const page = tweetToPageObject({
            code: 200,
            tweet: {
                url: "https://x.com/someperson/status/2",
                text: "watch this",
                author,
                media: {
                    videos: [
                        {
                            url: "https://video.twimg.com/vid/1920x1080/x.mp4",
                            thumbnail_url: "https://pbs.twimg.com/thumb/x.jpg",
                            width: 1920,
                            height: 1080,
                            duration: 9.3,
                        },
                    ],
                },
            },
        });
        expect(page?.image).toEqual([
            { url: "https://pbs.twimg.com/thumb/x.jpg", width: 1920, height: 1080 },
        ]);
        expect(page?.video).toEqual({
            url: "https://video.twimg.com/vid/1920x1080/x.mp4",
            thumbnail: "https://pbs.twimg.com/thumb/x.jpg",
            width: 1920,
            height: 1080,
            duration: 9.3,
        });
    });

    it("maps a text-only tweet without any image", () => {
        const page = tweetToPageObject({
            code: 200,
            tweet: {
                url: "https://x.com/someperson/status/3",
                text: "just words",
                author,
            },
        });
        expect(page?.description).toEqual("just words");
        expect(page?.image).toBeUndefined();
        expect(page?.video).toBeUndefined();
    });

    it("returns null for API errors so the caller can fall back", () => {
        expect(tweetToPageObject({ code: 404, message: "NOT_FOUND" })).toBeNull();
        expect(tweetToPageObject({ code: 200 })).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: malformed API payload
        expect(tweetToPageObject(undefined as any)).toBeNull();
    });
});
