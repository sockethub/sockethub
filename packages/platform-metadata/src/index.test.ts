import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Agent } from "undici";

// Capture the options passed to open-graph-scraper and control its outcome,
// so we can assert the platform injects a guarded dispatcher and reports
// errors robustly — without any network access.
let ogsOptions: Record<string, unknown> | undefined;
let ogsBehavior: () => Promise<{ result: Record<string, unknown> }> = () =>
    Promise.resolve({ result: {} });

mock.module("open-graph-scraper", () => ({
    default: (options: Record<string, unknown>) => {
        ogsOptions = options;
        return ogsBehavior();
    },
}));

const { default: Metadata } = await import("./index");

function makePlatform(config?: Record<string, unknown>) {
    // biome-ignore lint/suspicious/noExplicitAny: minimal fake session
    const platform = new Metadata({ log: { debug() {} } } as any);
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
        const fetchOptions = ogsOptions?.fetchOptions as
            | { headers?: Record<string, string> }
            | undefined;
        expect(fetchOptions?.headers?.["user-agent"]).toMatch(
            /SockethubBot\/.+\+https:\/\/sockethub\.org/,
        );
    });

    it("honors a packageConfig userAgent override", async () => {
        await runFetch(makePlatform({ userAgent: "MyDeployment/1.0" }));
        const fetchOptions = ogsOptions?.fetchOptions as
            | { headers?: Record<string, string> }
            | undefined;
        expect(fetchOptions?.headers?.["user-agent"]).toEqual(
            "MyDeployment/1.0",
        );
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

describe("reddit compatibility user agent", () => {
    beforeEach(() => {
        ogsOptions = undefined;
        ogsBehavior = () => Promise.resolve({ result: {} });
    });

    function sentUserAgent(): string | undefined {
        const fetchOptions = ogsOptions?.fetchOptions as
            | { headers?: Record<string, string> }
            | undefined;
        return fetchOptions?.headers?.["user-agent"];
    }

    it("scrapes reddit posts with an embed-crawler user agent", async () => {
        await runFetch(
            makePlatform(),
            "https://www.reddit.com/r/pics/comments/abc123/some_title/",
        );
        expect(ogsOptions?.url).toEqual(
            "https://www.reddit.com/r/pics/comments/abc123/some_title/",
        );
        expect(sentUserAgent()).toMatch(/Discordbot/);
    });

    it("covers redd.it short links", async () => {
        await runFetch(makePlatform(), "https://redd.it/abc123");
        expect(sentUserAgent()).toMatch(/Discordbot/);
    });

    it("honors a packageConfig compatUserAgent override", async () => {
        await runFetch(
            makePlatform({ compatUserAgent: "MyCrawler/2.0" }),
            "https://old.reddit.com/r/x/comments/id/",
        );
        expect(sentUserAgent()).toEqual("MyCrawler/2.0");
    });

    it("does not affect non-reddit scrapes", async () => {
        await runFetch(makePlatform(), "https://example.com/article");
        expect(ogsOptions?.url).toEqual("https://example.com/article");
        expect(sentUserAgent()).toMatch(/SockethubBot/);
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
