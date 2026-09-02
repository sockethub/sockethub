import { describe, expect, it } from "bun:test";
import {
    isFacebookUrl,
    isRedditUrl,
    normalizeDescription,
    parseRedditOEmbed,
    parseRedditPost,
    parseYouTubeOEmbed,
    redditOEmbedImage,
    redditPostImage,
    redditPostImages,
    redditPostVideo,
    resolveRedditEmbed,
    resolveRedditJson,
    resolveRedditMedia,
    resolveTwitterStatus,
    resolveYouTubeOEmbed,
    stripFacebookEngagement,
    tweetToPageObject,
    youtubeOEmbedImage,
} from "./resolvers";

describe("resolveYouTubeOEmbed", () => {
    it("resolves supported YouTube video URL forms", () => {
        for (const url of [
            "https://www.youtube.com/watch?v=eJnBBLKCLjE&t=10",
            "https://youtu.be/eJnBBLKCLjE?si=abc",
            "https://m.youtube.com/shorts/eJnBBLKCLjE",
            "https://youtube.com/live/eJnBBLKCLjE",
            "https://www.youtube.com/embed/eJnBBLKCLjE",
        ]) {
            expect(resolveYouTubeOEmbed(url)).toEqual(
                "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DeJnBBLKCLjE&format=json",
            );
        }
    });

    it("ignores non-video, malformed, and lookalike URLs", () => {
        expect(resolveYouTubeOEmbed("https://youtube.com/@channel")).toBeNull();
        expect(resolveYouTubeOEmbed("https://youtube.com/watch?v=short")).toBeNull();
        expect(resolveYouTubeOEmbed("https://notyoutube.com/watch?v=eJnBBLKCLjE")).toBeNull();
        expect(resolveYouTubeOEmbed("not a URL")).toBeNull();
    });
});

describe("YouTube oEmbed metadata", () => {
    it("validates and maps a thumbnail", () => {
        const embed = parseYouTubeOEmbed({
            title: "Video title",
            provider_name: "YouTube",
            thumbnail_url: "https://i.ytimg.com/vi/id/hqdefault.jpg",
            thumbnail_width: 480,
            thumbnail_height: 360,
            html: "ignored external field",
        });
        expect(embed).not.toBeNull();
        expect(youtubeOEmbedImage(embed!)).toEqual([
            {
                url: "https://i.ytimg.com/vi/id/hqdefault.jpg",
                width: 480,
                height: 360,
            },
        ]);
    });

    it("rejects malformed payloads and unsafe thumbnails", () => {
        expect(parseYouTubeOEmbed(null)).toBeNull();
        expect(parseYouTubeOEmbed({ title: "Video" })).toBeNull();
        expect(
            parseYouTubeOEmbed({
                title: "Video",
                thumbnail_url: "javascript:alert(1)",
            }),
        ).toBeNull();
        expect(
            parseYouTubeOEmbed({
                title: "Video",
                thumbnail_url: "https://i.ytimg.com/x.jpg",
                thumbnail_width: -1,
            }),
        ).toBeNull();
    });
});

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

describe("Reddit JSON metadata", () => {
    it("maps canonical posts to old.reddit JSON", () => {
        expect(
            resolveRedditJson(
                "https://www.reddit.com/r/pics/comments/abc123/title/",
            ),
        ).toEqual(
            "https://old.reddit.com/r/pics/comments/abc123/title.json?raw_json=1",
        );
        expect(resolveRedditJson("https://reddit.com/r/pics")).toBeNull();
    });

    it("validates a listing and selects only direct Reddit post media", () => {
        const post = parseRedditPost([
            {
                data: {
                    children: [
                        {
                            data: {
                                title: "Post",
                                selftext: "Body",
                                url: "https://i.redd.it/post.png",
                            },
                        },
                    ],
                },
            },
        ]);
        expect(post).not.toBeNull();
        expect(redditPostImage(post!)).toEqual([
            { url: "https://i.redd.it/post.png" },
        ]);
        expect(parseRedditPost([{ data: { children: [{ data: { title: 1 } }] } }])).toBeNull();
        expect(
            redditPostImage({ title: "Link", url: "https://example.com/a.png" }),
        ).toBeUndefined();
    });

    it("maps a hosted video and its preview image", () => {
        const post = parseRedditPost([
            {
                data: {
                    children: [
                        {
                            data: {
                                title: "Video post",
                                selftext: "",
                                url: "https://v.redd.it/abc123",
                                secure_media: {
                                    reddit_video: {
                                        fallback_url:
                                            "https://v.redd.it/abc123/CMAF_480.mp4?source=fallback",
                                        width: 480,
                                        height: 494,
                                        duration: 41,
                                    },
                                },
                                preview: {
                                    images: [
                                        {
                                            source: {
                                                url: "https://external-preview.redd.it/post.png?format=pjpg",
                                                width: 650,
                                                height: 670,
                                            },
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
            },
        ]);
        expect(post).not.toBeNull();
        expect(redditPostImage(post!)).toEqual([
            {
                url: "https://external-preview.redd.it/post.png?format=pjpg",
                width: 650,
                height: 670,
            },
        ]);
        expect(redditPostVideo(post!)).toEqual({
            url: "https://v.redd.it/abc123/CMAF_480.mp4?source=fallback",
            thumbnail:
                "https://external-preview.redd.it/post.png?format=pjpg",
            width: 480,
            height: 494,
            duration: 41,
        });
    });

    it("rejects untrusted Reddit video and preview URLs", () => {
        const post = {
            title: "Unsafe",
            secure_media: {
                reddit_video: {
                    fallback_url: "https://example.com/video.mp4",
                },
            },
            preview: {
                images: [
                    { source: { url: "javascript:alert(1)" } },
                ],
            },
        };
        expect(redditPostImage(post)).toBeUndefined();
        expect(redditPostVideo(post)).toBeUndefined();
    });

    it("never promotes an HTTP image to a video thumbnail", () => {
        const post = {
            title: "Hosted video with insecure poster",
            url: "http://i.redd.it/post.png",
            secure_media: {
                reddit_video: {
                    fallback_url: "https://v.redd.it/abc123/video.mp4",
                },
            },
        };
        expect(redditPostImage(post)).toBeUndefined();
        expect(redditPostVideo(post)).toEqual({
            url: "https://v.redd.it/abc123/video.mp4",
            thumbnail: undefined,
            width: undefined,
            height: undefined,
            duration: undefined,
        });
    });
});

describe("resolveRedditMedia", () => {
    it("unwraps a media-viewer link to its i.redd.it image", () => {
        expect(
            resolveRedditMedia(
                "https://www.reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fgz85tl8860yg1.png",
            ),
        ).toEqual("https://i.redd.it/gz85tl8860yg1.png");
    });

    it("accepts preview.redd.it targets and a trailing slash", () => {
        expect(
            resolveRedditMedia(
                "https://reddit.com/media/?url=https%3A%2F%2Fpreview.redd.it%2Fabc.jpg%3Fwidth%3D640",
            ),
        ).toEqual("https://preview.redd.it/abc.jpg?width=640");
    });

    it("rejects non-Reddit-CDN targets", () => {
        // The url param is attacker-controlled; only Reddit's own image
        // hosts may be echoed back as the preview image.
        expect(
            resolveRedditMedia(
                "https://www.reddit.com/media?url=https%3A%2F%2Fevil.example%2Fx.png",
            ),
        ).toBeNull();
        expect(
            resolveRedditMedia(
                "https://www.reddit.com/media?url=http%3A%2F%2Fi.redd.it%2Fx.png",
            ),
        ).toBeNull();
    });

    it("ignores missing or malformed url params", () => {
        expect(resolveRedditMedia("https://www.reddit.com/media")).toBeNull();
        expect(
            resolveRedditMedia("https://www.reddit.com/media?url=not-a-url"),
        ).toBeNull();
    });

    it("does not match other paths or hosts", () => {
        expect(
            resolveRedditMedia(
                "https://www.reddit.com/r/pics/comments/abc/post/",
            ),
        ).toBeNull();
        expect(
            resolveRedditMedia(
                "https://example.com/media?url=https%3A%2F%2Fi.redd.it%2Fx.png",
            ),
        ).toBeNull();
        expect(resolveRedditMedia("not a url")).toBeNull();
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

describe("isFacebookUrl", () => {
    it("matches facebook hosts and short links", () => {
        for (const url of [
            "https://www.facebook.com/share/v/1JudTFVg5h/?mibextid=wwXIfr",
            "https://facebook.com/SomePage/videos/1720321322579856/",
            "https://m.facebook.com/share/p/abc/",
            "https://web.facebook.com/reel/123",
            "https://fb.watch/abc123/",
            "https://fb.com/something",
        ]) {
            expect(isFacebookUrl(url)).toBeTrue();
        }
    });

    it("ignores other hosts and invalid URLs", () => {
        expect(isFacebookUrl("https://example.com/share/v/abc")).toBeFalse();
        // Lookalike suffix must not match (attacker-controlled host).
        expect(isFacebookUrl("https://notfacebook.com/share")).toBeFalse();
        expect(isFacebookUrl("https://facebook.com.evil.com/x")).toBeFalse();
        expect(isFacebookUrl("not a url")).toBeFalse();
    });
});

describe("stripFacebookEngagement", () => {
    it("strips the localized stats segment from video titles", () => {
        expect(
            stripFacebookEngagement(
                "2.2M views · 21K reactions | If YOU Take Vitamin D, You NEED To Stop! | Steven Bartlett",
            ),
        ).toEqual(
            "If YOU Take Vitamin D, You NEED To Stop! | Steven Bartlett",
        );
        // Stats arrive in the scraping server's geo-IP language.
        expect(
            stripFacebookEngagement(
                "2,2 mil. zhlédnutí · 21 tis. reakcí | Video | Author",
            ),
        ).toEqual("Video | Author");
        // Including locales whose stats use non-ASCII decimal digits.
        expect(
            stripFacebookEngagement(
                "٢٫٢ مليون مشاهدة · ٢١ ألف تفاعل | فيديو | Author",
            ),
        ).toEqual("فيديو | Author");
    });

    it("leaves titles without a stats segment untouched", () => {
        expect(stripFacebookEngagement("Steven Bartlett")).toEqual(
            "Steven Bartlett",
        );
        expect(stripFacebookEngagement("My video | Author")).toEqual(
            "My video | Author",
        );
        expect(stripFacebookEngagement(undefined)).toBeUndefined();
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

    it("maps an X Article body, title, and cover image", () => {
        const page = tweetToPageObject({
            code: 200,
            tweet: {
                url: "https://x.com/someperson/status/4",
                text: "",
                author,
                article: {
                    title: "How to fix your entire life in 1 day",
                    preview_text: "A short preview that should not win.",
                    cover_media: {
                        media_info: {
                            original_img_url:
                                "https://pbs.twimg.com/media/cover.jpg",
                            original_img_width: 1456,
                            original_img_height: 582,
                        },
                    },
                    content: {
                        blocks: [
                            { type: "unstyled", text: "First paragraph." },
                            { type: "atomic", text: " " },
                            { type: "header-two", text: "A heading" },
                            { type: "unstyled", text: "Second paragraph." },
                        ],
                    },
                },
            },
        });

        expect(page).toEqual({
            type: "page",
            title: "How to fix your entire life in 1 day",
            name: "X (formerly Twitter)",
            description:
                "First paragraph.\n\nA heading\n\nSecond paragraph.",
            url: "https://x.com/someperson/status/4",
            favicon: "https://x.com/favicon.ico",
            image: [
                {
                    url: "https://pbs.twimg.com/media/cover.jpg",
                    width: 1456,
                    height: 582,
                },
            ],
        });
    });

    it("uses an X Article preview when content blocks are unavailable", () => {
        const page = tweetToPageObject({
            code: 200,
            tweet: {
                text: "",
                author,
                article: { preview_text: "Article preview" },
            },
        });

        expect(page?.description).toEqual("Article preview");
    });

    it("uses the preview when X Article content blocks are malformed", () => {
        const page = tweetToPageObject({
            code: 200,
            tweet: {
                text: "",
                author,
                article: {
                    preview_text: "Safe fallback",
                    // biome-ignore lint/suspicious/noExplicitAny: malformed external payload
                    content: { blocks: "not an array" as any },
                },
            },
        });

        expect(page?.description).toEqual("Safe fallback");
    });

    it("uses tweet text when the X Article preview is blank", () => {
        const page = tweetToPageObject({
            code: 200,
            tweet: {
                text: "Tweet fallback",
                author,
                article: { preview_text: " \t\n " },
            },
        });

        expect(page?.description).toEqual("Tweet fallback");
    });

    it("returns null for API errors so the caller can fall back", () => {
        expect(tweetToPageObject({ code: 404, message: "NOT_FOUND" })).toBeNull();
        expect(tweetToPageObject({ code: 200 })).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: malformed API payload
        expect(tweetToPageObject(undefined as any)).toBeNull();
    });
});
