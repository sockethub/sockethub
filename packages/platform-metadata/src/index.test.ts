import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
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
        expect((err as Error).message).toEqual("ogs failed");
        expect(result).toBeUndefined();
    });

    it("reports a plain Error rejection without throwing a TypeError", async () => {
        ogsBehavior = () => Promise.reject(new Error("blocked non-public"));
        const { err } = await runFetch(makePlatform());
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/blocked non-public/);
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
