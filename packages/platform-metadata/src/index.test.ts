import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { isExpectedError } from "@sockethub/util/error";
import { Agent } from "undici";

// Capture the options passed to open-graph-scraper and control its outcome,
// so we can assert the platform injects a guarded dispatcher and reports
// errors robustly — without any network access.
let ogsOptions: Record<string, unknown> | undefined;
let ogsBehavior: () => Promise<{ result: Record<string, unknown> }> = () =>
    Promise.resolve({ result: {} });
let redditJsonBehavior: ((url: string) => Promise<unknown>) | undefined;

mock.module("open-graph-scraper", () => ({
    default: (options: Record<string, unknown>) => {
        ogsOptions = options;
        return ogsBehavior();
    },
}));

const { default: Metadata, withDeadline } = await import("./index");

/** The user-agent header the platform handed to open-graph-scraper. */
function sentUserAgent(): string | undefined {
    const fetchOptions = ogsOptions?.fetchOptions as
        | { headers?: Record<string, string> }
        | undefined;
    return fetchOptions?.headers?.["user-agent"];
}

function makePlatform(config?: Record<string, unknown>) {
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake session
    const platform = new Metadata({ log: { debug() {} } } as any);
    // Production uses Undici explicitly. Route it through the replaceable
    // global in unit tests so both remote stages remain deterministic.
    // biome-ignore lint/suspicious/noExplicitAny: test-only private override
    (platform as any).fetchImpl = (...args: Parameters<typeof fetch>) =>
        globalThis.fetch(...args);
    if (redditJsonBehavior) {
        // biome-ignore lint/suspicious/noExplicitAny: test-only private override
        (platform as any).fetchRedditJson = redditJsonBehavior;
    }
    if (config) {
        Object.assign(platform.config, config);
    }
    return platform;
}

function runFetch(
    platform: ReturnType<typeof makePlatform>,
    url = "https://example.com",
): Promise<{ err: unknown; result: unknown }> {
    const job = {
        "@context": ["x"],
        type: "fetch",
        actor: { id: url, type: "website" },
    };
    return new Promise((resolve) => {
        // biome-ignore lint/suspicious/noExplicitAny: test job
        platform.fetch(job as any, (err, result) => resolve({ err, result }));
    });
}

describe("metadata fetch SSRF hardening", () => {
    beforeEach(() => {
        // Reset shared mock state so a stale value from one test cannot make a
        // later assertion pass without exercising the current path.
        ogsOptions = undefined;
        ogsBehavior = () => Promise.resolve({ result: {} });
    });

    it("passes a guarded undici dispatcher to open-graph-scraper", async () => {
        ogsBehavior = () => Promise.resolve({ result: {} });
        await runFetch(makePlatform());
        const fetchOptions = ogsOptions?.fetchOptions as
            | { dispatcher?: unknown }
            | undefined;
        expect(fetchOptions?.dispatcher).toBeInstanceOf(Agent);
        expect(ogsOptions?.timeout).toEqual(5);
    });

    it("still passes a dispatcher when the escape hatch is enabled", async () => {
        ogsBehavior = () => Promise.resolve({ result: {} });
        await runFetch(makePlatform({ allowPrivateAddresses: true }));
        const fetchOptions = ogsOptions?.fetchOptions as
            | { dispatcher?: unknown }
            | undefined;
        expect(fetchOptions?.dispatcher).toBeInstanceOf(Agent);
    });

    it("reports the error from open-graph-scraper's { result } rejection", async () => {
        ogsBehavior = () =>
            Promise.reject({ result: { error: new Error("ogs failed") } });
        const { err, result } = await runFetch(makePlatform());
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toEqual(
            "metadata scrape failed for https://example.com: ogs failed",
        );
        expect(result).toBeUndefined();
    });

    it("reports a plain Error rejection without throwing a TypeError", async () => {
        ogsBehavior = () => Promise.reject(new Error("blocked non-public"));
        const { err } = await runFetch(makePlatform());
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/blocked non-public/);
    });

    it("marks scrape failures as expected operational errors", async () => {
        // Remote sites timing out or bot-blocking (403) must not be captured
        // as Sentry production errors by the job handler.
        ogsBehavior = () =>
            Promise.reject({ result: { error: new Error("403 Forbidden") } });
        const { err } = await runFetch(makePlatform());
        expect(isExpectedError(err)).toBe(true);
        expect((err as Error).message).toEqual(
            "metadata scrape failed for https://example.com: 403 Forbidden",
        );
    });
});

describe("scrape user agent", () => {
    beforeEach(() => {
        ogsOptions = undefined;
        ogsBehavior = () => Promise.resolve({ result: {} });
    });

    it("sends an identifiable bot user agent by default", async () => {
        await runFetch(makePlatform());
        expect(sentUserAgent()).toMatch(
            /SockethubBot\/.+\+https:\/\/sockethub\.org/,
        );
    });

    it("honors a packageConfig userAgent override", async () => {
        await runFetch(makePlatform({ userAgent: "MyDeployment/1.0" }));
        expect(sentUserAgent()).toEqual("MyDeployment/1.0");
    });
});

describe("direct image links", () => {
    const realFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    it("returns image metadata when the origin confirms an image", async () => {
        // biome-ignore lint/suspicious/noExplicitAny: controlled image response
        globalThis.fetch = (() =>
            Promise.resolve(
                new Response(null, {
                    status: 200,
                    headers: { "content-type": "image/jpeg" },
                }),
            )) as any;
        const { err, result } = await runFetch(
            makePlatform(),
            "https://images.example/A-photo_01.JPG?size=large",
        );
        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toMatchObject({
            title: "A photo 01",
            image: [
                {
                    url: "https://images.example/A-photo_01.JPG?size=large",
                    type: "image/jpeg",
                },
            ],
        });
    });

    it("uses the final image URL consistently after a redirect", async () => {
        // biome-ignore lint/suspicious/noExplicitAny: minimal redirected response
        globalThis.fetch = (() =>
            Promise.resolve({
                ok: true,
                url: "https://cdn.example/final.jpg",
                headers: new Headers({ "content-type": "image/jpeg" }),
                body: null,
            })) as any;
        const { result } = await runFetch(
            makePlatform(),
            "https://images.example/original.jpg",
        );
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).actor.id).toEqual(
            "https://cdn.example/final.jpg",
        );
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.url).toEqual(
            "https://cdn.example/final.jpg",
        );
    });

    it("uses extension metadata when a bot-blocked origin returns 403", async () => {
        // biome-ignore lint/suspicious/noExplicitAny: controlled blocked response
        globalThis.fetch = (() =>
            Promise.resolve(new Response("blocked", { status: 403 }))) as any;
        const { err, result } = await runFetch(
            makePlatform(),
            "https://images.example/a%20real%20photo.webp",
        );
        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.image).toEqual([
            {
                url: "https://images.example/a%20real%20photo.webp",
                type: "image/webp",
            },
        ]);
    });

    it("scrapes HTML served from a URL with an image suffix", async () => {
        ogsBehavior = () =>
            Promise.resolve({ result: { ogTitle: "Actually a page" } });
        // biome-ignore lint/suspicious/noExplicitAny: controlled HTML response
        globalThis.fetch = (() =>
            Promise.resolve(
                new Response("<html></html>", {
                    headers: { "content-type": "text/html" },
                }),
            )) as any;
        const { result } = await runFetch(
            makePlatform(),
            "https://example.com/not-really.jpg",
        );
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.title).toEqual("Actually a page");
    });

    it("returns fallback metadata when the image probe never settles", async () => {
        globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
        const platform = makePlatform({ allowPrivateAddresses: true });
        const job = {
            "@context": ["x"],
            type: "fetch",
            actor: {
                id: "http://127.0.0.1/stalled.jpg",
                type: "website",
            },
        };
        const result = await new Promise((resolve) => {
            // Exercise a short hard deadline without slowing the test suite.
            // biome-ignore lint/suspicious/noExplicitAny: private method regression test
            (platform as any).fetchDirectImage(
                job,
                {
                    title: "stalled",
                    type: "image/jpeg",
                    url: job.actor.id,
                },
                (_err: unknown, produced: unknown) => resolve(produced),
                5,
            );
        });
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.image).toEqual([
            {
                url: "http://127.0.0.1/stalled.jpg",
                type: "image/jpeg",
            },
        ]);
    });
});

describe("facebook scrape", () => {
    beforeEach(() => {
        ogsOptions = undefined;
        ogsBehavior = () => Promise.resolve({ result: {} });
    });

    it("presents the compatibility crawler user agent", async () => {
        await runFetch(
            makePlatform(),
            "https://www.facebook.com/share/v/1JudTFVg5h/?mibextid=wwXIfr",
        );
        expect(ogsOptions?.url).toEqual(
            "https://www.facebook.com/share/v/1JudTFVg5h/?mibextid=wwXIfr",
        );
        expect(sentUserAgent()).toMatch(/Discordbot/);
    });

    it("strips engagement stats from the title and supplies the site name", async () => {
        ogsBehavior = () =>
            Promise.resolve({
                result: {
                    ogTitle:
                        "2.2M views · 21K reactions | If YOU Take Vitamin D, You NEED To Stop! | Steven Bartlett",
                    ogDescription: "If YOU Take Vitamin D, You NEED To Stop!",
                    ogUrl: "https://www.facebook.com/SteveBartlettShow/posts/1607733517402185/",
                    ogImage: [
                        {
                            url: "https://scontent.example/thumb.jpg",
                            alt: "2.2M views · 21K reactions | If YOU Take Vitamin D, You NEED To Stop! | Steven Bartlett",
                        },
                    ],
                },
            });
        const { err, result } = await runFetch(
            makePlatform(),
            "https://www.facebook.com/share/v/1JudTFVg5h/",
        );
        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).actor.name).toEqual("Facebook");
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toMatchObject({
            title: "If YOU Take Vitamin D, You NEED To Stop! | Steven Bartlett",
            name: "Facebook",
            description: "If YOU Take Vitamin D, You NEED To Stop!",
            image: [
                {
                    url: "https://scontent.example/thumb.jpg",
                    alt: "If YOU Take Vitamin D, You NEED To Stop! | Steven Bartlett",
                },
            ],
        });
    });

    it("does not rewrite titles on non-facebook pages", async () => {
        ogsBehavior = () =>
            Promise.resolve({
                result: { ogTitle: "5 things · 3 ideas | A listicle" },
            });
        const { result } = await runFetch(
            makePlatform(),
            "https://example.com/article",
        );
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.title).toEqual(
            "5 things · 3 ideas | A listicle",
        );
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.name).toBeUndefined();
    });
});

describe("favicon fallback", () => {
    beforeEach(() => {
        ogsOptions = undefined;
    });

    it("defaults to the conventional /favicon.ico when the page declares none", async () => {
        ogsBehavior = () => Promise.resolve({ result: { ogTitle: "T" } });
        const { result } = await runFetch(makePlatform());
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.favicon).toEqual("/favicon.ico");
    });

    it("keeps the page's declared favicon", async () => {
        ogsBehavior = () =>
            Promise.resolve({ result: { favicon: "https://x/i.svg" } });
        const { result } = await runFetch(makePlatform());
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.favicon).toEqual("https://x/i.svg");
    });
});

describe("reddit structured metadata", () => {
    const realFetch = globalThis.fetch;
    let fetchCalls: Array<{ url: string; options?: RequestInit }> = [];
    let postResponse: Record<string, unknown> = {};
    let redditJsonUrl: string | undefined;

    beforeEach(() => {
        ogsOptions = undefined;
        ogsBehavior = () => Promise.resolve({ result: {} });
        fetchCalls = [];
        postResponse = {
            title: "A Reddit post",
            selftext: "First paragraph\n\n\n\nSecond paragraph",
            url_overridden_by_dest: "https://i.redd.it/post.png",
        };
        redditJsonUrl = undefined;
        redditJsonBehavior = (url) => {
            redditJsonUrl = url;
            return Promise.resolve([
                { data: { children: [{ data: postResponse }] } },
            ]);
        };
        // biome-ignore lint/suspicious/noExplicitAny: controlled Reddit fetch stub
        globalThis.fetch = ((url: URL, options?: RequestInit) => {
            fetchCalls.push({ url: String(url), options });
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve([
                        { data: { children: [{ data: postResponse }] } },
                    ]),
            });
        }) as any;
    });

    afterEach(() => {
        globalThis.fetch = realFetch;
        redditJsonBehavior = undefined;
    });

    it("uses old.reddit JSON without scraping HTML", async () => {
        const { err, result } = await runFetch(
            makePlatform(),
            "https://www.reddit.com/r/pics/comments/abc123/some_title/",
        );
        expect(err).toBeNull();
        expect(redditJsonUrl).toEqual(
            "https://old.reddit.com/r/pics/comments/abc123/some_title.json?raw_json=1",
        );
        expect(ogsOptions).toBeUndefined();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toMatchObject({
            title: "A Reddit post",
            description: "First paragraph\n\nSecond paragraph",
            image: [{ url: "https://i.redd.it/post.png" }],
        });
    });

    it("uses the configured compatibility user agent", async () => {
        await runFetch(
            makePlatform({ compatUserAgent: "MyCrawler/1.0" }),
            "https://old.reddit.com/r/x/comments/id/post/",
        );
        expect(redditJsonUrl).toStartWith("https://old.reddit.com");
    });

    it("does not affect non-reddit scrapes", async () => {
        await runFetch(makePlatform(), "https://example.com/article");
        expect(ogsOptions?.url).toEqual("https://example.com/article");
        expect(sentUserAgent()).toMatch(/SockethubBot/);
    });

    it("returns no image for text posts", async () => {
        postResponse = { title: "Text only", selftext: "Body" };
        const { result } = await runFetch(
            makePlatform(),
            "https://reddit.com/r/words/comments/abc123/post/",
        );
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.image).toBeUndefined();
    });

    it("returns Reddit hosted video metadata and its poster", async () => {
        postResponse = {
            title: "Hosted video",
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
                            url: "https://external-preview.redd.it/post.png",
                            width: 650,
                            height: 670,
                        },
                    },
                ],
            },
        };
        const { err, result } = await runFetch(
            makePlatform(),
            "https://reddit.com/r/videos/comments/abc123/post/",
        );
        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toMatchObject({
            description: "",
            image: [
                {
                    url: "https://external-preview.redd.it/post.png",
                    width: 650,
                    height: 670,
                },
            ],
            video: {
                url: "https://v.redd.it/abc123/CMAF_480.mp4?source=fallback",
                thumbnail: "https://external-preview.redd.it/post.png",
                width: 480,
                height: 494,
                duration: 41,
            },
        });
    });

    it("unwraps reddit.com/media links without any network request", async () => {
        const { err, result } = await runFetch(
            makePlatform(),
            "https://www.reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fgz85tl8860yg1.png",
        );
        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toMatchObject({
            type: "page",
            title: "gz85tl8860yg1.png",
            name: "reddit",
            image: [{ url: "https://i.redd.it/gz85tl8860yg1.png" }],
            url: "https://www.reddit.com/media?url=https%3A%2F%2Fi.redd.it%2Fgz85tl8860yg1.png",
        });
        // The image URL came from the link itself: no JSON, oEmbed, or
        // scrape round-trips.
        expect(redditJsonUrl).toBeUndefined();
        expect(fetchCalls).toHaveLength(0);
        expect(ogsOptions).toBeUndefined();
    });

    it("marks the no-metadata Reddit failure as expected", async () => {
        // A Reddit URL shape with no JSON endpoint and a failing oEmbed —
        // the job fails, but as an expected operational outcome.
        redditJsonBehavior = () => Promise.reject(new Error("no JSON"));
        globalThis.fetch = (() =>
            Promise.resolve({
                ok: false,
                status: 400,
                json: () => Promise.reject(new Error("no body")),
            })) as any;
        const { err } = await runFetch(
            makePlatform(),
            "https://www.reddit.com/gallery/abc123",
        );
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toEqual(
            "No Reddit metadata available for https://www.reddit.com/gallery/abc123",
        );
        expect(isExpectedError(err)).toBe(true);
    });

    it("falls back to oEmbed when Reddit JSON fails", async () => {
        redditJsonBehavior = () => Promise.reject(new Error("JSON down"));
        globalThis.fetch = ((url: URL) =>
            Promise.resolve({
                      ok: true,
                      status: 200,
                      json: () =>
                          Promise.resolve({
                              title: "Fallback title",
                              provider_name: "reddit",
                          }),
                  })) as any;
        const { err, result } = await runFetch(
            makePlatform(),
            "https://reddit.com/r/words/comments/abc123/post/",
        );
        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toMatchObject({
            type: "page",
            title: "Fallback title",
            name: "reddit",
            image: undefined,
        });
    });
});

describe("description normalization", () => {
    it("keeps paragraphs but removes pathological whitespace", async () => {
        ogsBehavior = () =>
            Promise.resolve({
                result: {
                    ogDescription:
                        "  First\tline  \r\n\r\n\r\n\r\n Second\u00a0 line ",
                },
            });
        const { result } = await runFetch(makePlatform());
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.description).toEqual(
            "First line\n\nSecond line",
        );
    });
});

describe("scrape deadline", () => {
    it("rejects even when the underlying request never settles", async () => {
        const stalled = new Promise<never>(() => {});
        await expect(withDeadline(stalled, 5)).rejects.toThrow(
            "metadata scrape timed out after 5ms",
        );
    });
});

describe("youtube video resolution", () => {
    const realFetch = globalThis.fetch;
    let fetchedUrl: string | undefined;

    beforeEach(() => {
        ogsOptions = undefined;
        ogsBehavior = () =>
            Promise.resolve({
                result: {
                    ogTitle: "Scraped title",
                    ogDescription: "The video description",
                    ogSiteName: "YouTube",
                    ogUrl: "https://www.youtube.com/watch?v=eJnBBLKCLjE",
                },
            });
        fetchedUrl = undefined;
        // biome-ignore lint/suspicious/noExplicitAny: controlled YouTube fetch stub
        globalThis.fetch = ((url: string) => {
            fetchedUrl = String(url);
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                    Promise.resolve({
                        title: "oEmbed title",
                        provider_name: "YouTube",
                        thumbnail_url:
                            "https://i.ytimg.com/vi/eJnBBLKCLjE/hqdefault.jpg",
                        thumbnail_width: 480,
                        thumbnail_height: 360,
                    }),
            });
        }) as any;
    });

    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    it("combines the scraped description with the official thumbnail", async () => {
        const { err, result } = await runFetch(
            makePlatform(),
            "https://www.youtube.com/watch?v=eJnBBLKCLjE",
        );

        expect(err).toBeNull();
        expect(fetchedUrl).toEqual(
            "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DeJnBBLKCLjE&format=json",
        );
        expect(sentUserAgent()).toMatch(/Discordbot/);
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toMatchObject({
            title: "oEmbed title",
            name: "YouTube",
            description: "The video description",
            image: [
                {
                    url: "https://i.ytimg.com/vi/eJnBBLKCLjE/hqdefault.jpg",
                    width: 480,
                    height: 360,
                },
            ],
        });
    });

    it("keeps a higher-quality scraped thumbnail when available", async () => {
        ogsBehavior = () =>
            Promise.resolve({
                result: {
                    ogDescription: "Description",
                    ogImage: [
                        {
                            url: "https://i.ytimg.com/vi/eJnBBLKCLjE/maxresdefault.jpg",
                        },
                    ],
                },
            });

        const { result } = await runFetch(
            makePlatform(),
            "https://youtu.be/eJnBBLKCLjE",
        );
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.image).toEqual([
            {
                url: "https://i.ytimg.com/vi/eJnBBLKCLjE/maxresdefault.jpg",
            },
        ]);
    });

    it("falls back to oEmbed when the page scrape fails", async () => {
        ogsBehavior = () => Promise.reject(new Error("scrape unavailable"));

        const { err, result } = await runFetch(
            makePlatform(),
            "https://www.youtube.com/watch?v=eJnBBLKCLjE",
        );

        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object).toEqual({
            type: "page",
            title: "oEmbed title",
            name: "YouTube",
            description: "",
            image: [
                {
                    url: "https://i.ytimg.com/vi/eJnBBLKCLjE/hqdefault.jpg",
                    width: 480,
                    height: 360,
                },
            ],
            url: "https://www.youtube.com/watch?v=eJnBBLKCLjE",
            favicon: "/favicon.ico",
        });
    });
});

describe("twitter status resolution", () => {
    const realFetch = globalThis.fetch;
    let fetchedUrl: string | undefined;
    let fetchedInit: Record<string, unknown> | undefined;
    let tweetResponse: () => Promise<unknown> = () =>
        Promise.resolve({ code: 404, message: "NOT_FOUND" });

    beforeEach(() => {
        ogsOptions = undefined;
        ogsBehavior = () => Promise.resolve({ result: { ogTitle: "scraped" } });
        fetchedUrl = undefined;
        fetchedInit = undefined;
        // biome-ignore lint/suspicious/noExplicitAny: test fetch stub
        globalThis.fetch = ((url: string, init: Record<string, unknown>) => {
            fetchedUrl = String(url);
            fetchedInit = init;
            return Promise.resolve({
                json: () => tweetResponse(),
            });
        }) as any;
    });

    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    it("resolves a status through the FxTwitter API with the post's own media", async () => {
        tweetResponse = () =>
            Promise.resolve({
                code: 200,
                tweet: {
                    url: "https://x.com/someperson/status/11",
                    text: "post text",
                    author: { name: "Some Person", screen_name: "someperson" },
                    media: {
                        photos: [
                            { url: "https://pbs.twimg.com/media/a.jpg" },
                        ],
                    },
                },
            });
        const { err, result } = await runFetch(
            makePlatform(),
            "https://x.com/someperson/status/11",
        );
        expect(err).toBeNull();
        expect(fetchedUrl).toEqual("https://api.fxtwitter.com/status/11");
        const headers = fetchedInit?.headers as Record<string, string>;
        expect(headers["user-agent"]).toMatch(/SockethubBot/);
        // The guarded dispatcher rides along on the API call too.
        expect(fetchedInit?.dispatcher).toBeInstanceOf(Agent);
        // And a per-request timeout, so a stalled API cannot stall the
        // scrape fallback.
        expect(fetchedInit?.signal).toBeInstanceOf(AbortSignal);
        // The OG scrape pipeline is bypassed entirely.
        expect(ogsOptions).toBeUndefined();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        const job = result as any;
        expect(job.object.description).toEqual("post text");
        expect(job.object.image).toEqual([
            { url: "https://pbs.twimg.com/media/a.jpg" },
        ]);
    });

    it("returns the body of an X Article whose tweet text is empty", async () => {
        tweetResponse = () =>
            Promise.resolve({
                code: 200,
                tweet: {
                    url: "https://x.com/thedankoe/status/2010751592346030461",
                    text: "",
                    author: { name: "DAN KOE", screen_name: "thedankoe" },
                    article: {
                        title: "How to fix your entire life in 1 day",
                        content: {
                            blocks: [
                                {
                                    type: "unstyled",
                                    text: "If you're anything like me, you think new years resolutions are stupid.",
                                },
                                {
                                    type: "unstyled",
                                    text: "Because most people go about changing their lives in the completely wrong way.",
                                },
                            ],
                        },
                    },
                },
            });

        const { err, result } = await runFetch(
            makePlatform(),
            "https://x.com/thedankoe/status/2010751592346030461",
        );

        expect(err).toBeNull();
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        const job = result as any;
        expect(job.object.title).toEqual(
            "How to fix your entire life in 1 day",
        );
        expect(job.object.description).toEqual(
            "If you're anything like me, you think new years resolutions are stupid.\n\nBecause most people go about changing their lives in the completely wrong way.",
        );
    });

    it("falls back to the OG scrape when the FxTwitter API errors", async () => {
        tweetResponse = () => Promise.reject(new Error("api down"));
        const { err, result } = await runFetch(
            makePlatform(),
            "https://x.com/someperson/status/12",
        );
        expect(err).toBeNull();
        expect(ogsOptions?.url).toEqual("https://x.com/someperson/status/12");
        // biome-ignore lint/suspicious/noExplicitAny: test result shape
        expect((result as any).object.title).toEqual("scraped");
    });

    it("falls back to the OG scrape for deleted/unavailable posts", async () => {
        tweetResponse = () =>
            Promise.resolve({ code: 404, message: "NOT_FOUND" });
        const { err } = await runFetch(
            makePlatform(),
            "https://twitter.com/someperson/status/13",
        );
        expect(err).toBeNull();
        expect(ogsOptions?.url).toEqual(
            "https://twitter.com/someperson/status/13",
        );
    });

    it("does not intercept non-status twitter URLs", async () => {
        await runFetch(makePlatform(), "https://x.com/someperson");
        expect(fetchedUrl).toBeUndefined();
        expect(ogsOptions?.url).toEqual("https://x.com/someperson");
    });
});
