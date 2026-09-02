import { request as httpsRequest } from "node:https";
import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import { markExpectedError, toError } from "@sockethub/util/error";
import { createGuardedDispatcher } from "@sockethub/util/net";
import ogs from "open-graph-scraper";
import { fetch as undiciFetch } from "undici";
import packageJson from "../package.json" with { type: "json" };
import {
    type FxTwitterStatus,
    isFacebookUrl,
    isRedditUrl,
    normalizeDescription,
    parseRedditOEmbed,
    parseRedditPost,
    parseYouTubeOEmbed,
    type RedditOEmbed,
    redditOEmbedImage,
    redditPostImage,
    redditPostImages,
    redditPostVideo,
    resolveRedditJson,
    resolveRedditMedia,
    resolveTwitterStatus,
    resolveYouTubeOEmbed,
    stripFacebookEngagement,
    tweetToPageObject,
    type YouTubeOEmbed,
    youtubeOEmbedImage,
} from "./resolvers";
import { PlatformMetadataSchema } from "./schema";

/**
 * Sent with every outbound request. Sites gate their scraper-facing
 * behavior on the user agent, and many reject undici's default UA
 * outright. Identify honestly as a bot; override per deployment via
 * `packageConfig.userAgent`.
 */
const DEFAULT_USER_AGENT = `Mozilla/5.0 (compatible; SockethubBot/${packageJson.version}; +https://sockethub.org)`;

/**
 * Sent to sites that serve their Open Graph payload only to *recognized*
 * embed crawlers — Reddit returns a page with no OG data (and 403s
 * datacenter addresses) for anything it doesn't know. Presenting a
 * link-preview crawler UA is the established practice for self-hosted
 * preview fetchers; override per deployment via
 * `packageConfig.compatUserAgent`.
 */
const COMPAT_USER_AGENT =
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)";

/**
 * Cap on the FxTwitter API round-trip. The guarded dispatcher bounds
 * response size but not time — without this, a stalled API request would
 * also stall the scrape fallback.
 */
const TWEET_API_TIMEOUT_MS = 10_000;
const REDDIT_OEMBED_URL = "https://www.reddit.com/oembed";
const REDDIT_OEMBED_TIMEOUT_MS = 4_000;
const YOUTUBE_OEMBED_TIMEOUT_MS = 4_000;
const SCRAPE_TIMEOUT_MS = 5_000;
const REDDIT_JSON_TIMEOUT_MS = 2_500;
const REDDIT_JSON_MAX_BYTES = 1_000_000;

const IMAGE_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
    avif: "image/avif",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};

function directImageCandidate(
    rawUrl: string,
): { title: string; type: string; url: string } | undefined {
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") return;
        const filename = decodeURIComponent(
            url.pathname.split("/").at(-1) || "",
        );
        const extension = filename.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
        const type = extension && IMAGE_TYPES_BY_EXTENSION[extension];
        if (!type) return;
        return {
            title: filename.slice(0, -(extension.length + 1)),
            type,
            url: url.href,
        };
    } catch {
        return;
    }
}

/** Enforce a deadline independently of a dependency's AbortSignal handling. */
export function withDeadline<T>(
    promise: Promise<T>,
    timeoutMs: number,
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () =>
                reject(
                    new Error(`metadata scrape timed out after ${timeoutMs}ms`),
                ),
            timeoutMs,
        );
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

export default class Metadata implements PlatformInterface {
    private readonly log: Logger;
    private readonly fetchImpl = undiciFetch;
    private dispatcher?: ReturnType<typeof createGuardedDispatcher>;
    config: PlatformConfig = {
        persist: false,
    };
    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    /**
     * The SSRF-guarded undici dispatcher, created once per instance (its
     * `allowPrivateAddresses` setting comes from packageConfig, fixed before the
     * first job) and reused across fetches so connections/timers are pooled.
     */
    private getDispatcher(): ReturnType<typeof createGuardedDispatcher> {
        if (!this.dispatcher) {
            this.dispatcher = createGuardedDispatcher({
                allowPrivateAddresses:
                    this.config.allowPrivateAddresses === true,
            });
        }
        return this.dispatcher;
    }

    get schema() {
        return PlatformMetadataSchema;
    }

    /**
     * Stateless platforms are always ready to handle jobs.
     */
    isInitialized(): boolean {
        return true;
    }

    private userAgent(): string {
        return typeof this.config.userAgent === "string" &&
            this.config.userAgent
            ? this.config.userAgent
            : DEFAULT_USER_AGENT;
    }

    private compatUserAgent(): string {
        return typeof this.config.compatUserAgent === "string" &&
            this.config.compatUserAgent
            ? this.config.compatUserAgent
            : COMPAT_USER_AGENT;
    }

    fetch(job: ActivityStream, cb: PlatformCallback) {
        this.log.debug(`fetching ${job.actor.id}`);
        // X/Twitter never exposes a post's own media via Open Graph — it
        // serves a generic site banner to every scraper — so status URLs
        // resolve through FxTwitter's JSON API instead, which returns the
        // tweet text plus direct photo/video URLs. Anything else (including
        // an FxTwitter failure) goes through the regular OG scrape.
        const tweetApiUrl = resolveTwitterStatus(job.actor.id);
        if (tweetApiUrl) {
            this.fetchTweet(tweetApiUrl, job, cb);
            return;
        }
        if (isRedditUrl(job.actor.id)) {
            this.fetchReddit(job, cb);
            return;
        }
        const youtubeOEmbedUrl = resolveYouTubeOEmbed(job.actor.id);
        if (youtubeOEmbedUrl) {
            const embed = withDeadline(
                this.fetchYouTubeEmbed(youtubeOEmbedUrl),
                YOUTUBE_OEMBED_TIMEOUT_MS,
            ).catch(() => undefined);
            this.scrape(job, cb, undefined, job.actor.id, embed);
            return;
        }
        const image = directImageCandidate(job.actor.id);
        if (image) {
            this.fetchDirectImage(job, image, cb);
            return;
        }
        this.scrape(job, cb);
    }

    /**
     * Verify likely direct-image links when possible. Origins commonly block
     * server-side preview agents, so a strong file extension remains a useful
     * fallback: the client can still request the original resource itself.
     */
    private async fetchDirectImage(
        job: ActivityStream,
        candidate: { title: string; type: string; url: string },
        cb: PlatformCallback,
    ) {
        try {
            const res = await this.fetchImpl(candidate.url, {
                dispatcher: this.getDispatcher(),
                headers: {
                    accept: "image/avif,image/webp,image/*,*/*;q=0.8",
                    "user-agent": this.userAgent(),
                },
                signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
            } as RequestInit & {
                dispatcher: ReturnType<typeof createGuardedDispatcher>;
            });
            const contentType = res.headers
                .get("content-type")
                ?.split(";", 1)[0]
                .trim()
                .toLowerCase();
            if (res.ok && contentType?.startsWith("text/html")) {
                if (res.body) await res.body.cancel();
                this.scrape(job, cb);
                return;
            }
            if (res.ok && contentType && !contentType.startsWith("image/")) {
                if (res.body) await res.body.cancel();
                this.scrape(job, cb);
                return;
            }
            if (res.body) await res.body.cancel();
            if (res.ok && contentType?.startsWith("image/")) {
                candidate.type = contentType;
                candidate.url = res.url || candidate.url;
            }
        } catch (err) {
            this.log.debug(
                `direct image probe failed for ${candidate.url}: ${String(err)}; using URL metadata`,
            );
        }
        job.object = {
            type: "page",
            title: candidate.title.replace(/[_-]+/g, " ").trim(),
            description: "",
            image: [{ url: candidate.url, type: candidate.type }],
            url: candidate.url,
            favicon: "/favicon.ico",
        };
        cb(null, job);
    }

    /** Fetch and validate YouTube's official preview metadata. */
    private async fetchYouTubeEmbed(
        embedUrl: string,
    ): Promise<YouTubeOEmbed | undefined> {
        try {
            const res = await this.fetchImpl(embedUrl, {
                dispatcher: this.getDispatcher(),
                headers: { "user-agent": this.userAgent() },
                signal: AbortSignal.timeout(YOUTUBE_OEMBED_TIMEOUT_MS),
            } as RequestInit & {
                dispatcher: ReturnType<typeof createGuardedDispatcher>;
            });
            if (!res.ok) {
                throw new Error(`YouTube oEmbed returned HTTP ${res.status}`);
            }
            const embed = parseYouTubeOEmbed(await res.json());
            if (!embed) {
                throw new Error("YouTube oEmbed returned an invalid payload");
            }
            return embed;
        } catch (err) {
            this.log.debug(
                `youtube oEmbed fetch failed for ${embedUrl}: ${String(err)}; using scraped metadata`,
            );
            return undefined;
        }
    }

    private async fetchTweet(
        apiUrl: string,
        job: ActivityStream,
        cb: PlatformCallback,
    ) {
        try {
            const res = await this.fetchImpl(apiUrl, {
                dispatcher: this.getDispatcher(),
                headers: { "user-agent": this.userAgent() },
                signal: AbortSignal.timeout(TWEET_API_TIMEOUT_MS),
            } as RequestInit & {
                dispatcher: ReturnType<typeof createGuardedDispatcher>;
            });
            const status = (await res.json()) as FxTwitterStatus;
            const page = tweetToPageObject(status);
            if (page) {
                job.actor.id = page.url || job.actor.id;
                job.actor.name = page.name || job.actor.name || "";
                job.object = page;
                cb(null, job);
                return;
            }
            this.log.debug(
                `fxtwitter returned no usable data for ${job.actor.id} (code ${status?.code}); falling back to scrape`,
            );
        } catch (err) {
            // The FxTwitter API being down must not break previews entirely —
            // the plain scrape still yields the post text.
            this.log.debug(
                `fxtwitter fetch failed for ${job.actor.id}: ${String(err)}; falling back to scrape`,
            );
        }
        this.scrape(job, cb);
    }

    private async fetchReddit(job: ActivityStream, cb: PlatformCallback) {
        // reddit.com/media?url=… wraps a single hosted image; Reddit serves
        // neither post JSON nor oEmbed for it, so the network pipeline below
        // can only fail. The image URL is embedded in the link itself —
        // answer from it directly.
        const mediaImage = resolveRedditMedia(job.actor.id);
        if (mediaImage) {
            const imagePath = new URL(mediaImage).pathname;
            let title: string;
            try {
                title = decodeURIComponent(imagePath).slice(1);
            } catch {
                // Malformed percent-sequences survive URL parsing; the title
                // is cosmetic, so fall back to the undecoded filename.
                title = imagePath.slice(1);
            }
            job.actor.name = "reddit";
            job.object = {
                type: "page",
                title,
                name: "reddit",
                description: "",
                image: [{ url: mediaImage }],
                url: job.actor.id,
                favicon: "/favicon.ico",
            };
            this.log.debug(`reddit media link unwrapped for ${job.actor.id}`);
            cb(null, job);
            return;
        }
        const jsonUrl = resolveRedditJson(job.actor.id);
        // Start the title fallback immediately. If the richer post JSON fails,
        // this has usually completed already and does not extend the response
        // budget by another network timeout.
        const embedPromise = withDeadline(
            this.fetchRedditEmbed(job.actor.id),
            REDDIT_JSON_TIMEOUT_MS,
        ).catch(() => undefined);
        if (jsonUrl) {
            try {
                this.log.debug(`reddit JSON started for ${job.actor.id}`);
                const post = parseRedditPost(
                    await withDeadline(
                        this.fetchRedditJson(jsonUrl),
                        REDDIT_JSON_TIMEOUT_MS,
                    ),
                );
                if (!post)
                    throw new Error("Reddit JSON returned an invalid payload");
                job.actor.name = "reddit";
                job.object = {
                    type: "page",
                    title: post.title,
                    name: "reddit",
                    description: normalizeDescription(post.selftext ?? ""),
                    image: redditPostImage(post),
                    video: redditPostVideo(post),
                    url: job.actor.id,
                    favicon: "/favicon.ico",
                };
                this.log.debug(`reddit JSON completed for ${job.actor.id}`);
                cb(null, job);
                return;
            } catch (err) {
                this.log.debug(
                    `reddit JSON failed for ${job.actor.id}: ${String(err)}; falling back to oEmbed`,
                );
            }
        }

        const embed = await embedPromise;
        if (embed?.title) {
            job.actor.name = embed.provider_name || "reddit";
            job.object = {
                type: "page",
                title: embed.title,
                name: embed.provider_name || "reddit",
                description: "",
                image: redditOEmbedImage(embed),
                url: job.actor.id,
                favicon: "/favicon.ico",
            };
            cb(null, job);
            return;
        }
        // Expected outcome for deleted/blocked posts and unrecognized Reddit
        // link shapes, not a server defect — keep it out of Sentry.
        cb(
            markExpectedError(
                new Error(`No Reddit metadata available for ${job.actor.id}`),
            ),
        );
    }

    /**
     * Fetch Reddit's fixed-host JSON endpoint without the Undici dispatcher.
     * The platform child runtime has exhibited stuck Undici requests even when
     * AbortSignal fires. node:https gives us an independently enforced socket
     * timeout; the outer withDeadline still guarantees callback completion.
     */
    private fetchRedditJson(url: string): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const req = httpsRequest(
                url,
                {
                    headers: { "user-agent": this.compatUserAgent() },
                },
                (res) => {
                    if (res.statusCode !== 200) {
                        res.resume();
                        reject(
                            new Error(
                                `Reddit JSON returned HTTP ${res.statusCode}`,
                            ),
                        );
                        return;
                    }
                    let bytes = 0;
                    const chunks: Buffer[] = [];
                    res.on("data", (chunk: Buffer) => {
                        bytes += chunk.length;
                        if (bytes > REDDIT_JSON_MAX_BYTES) {
                            req.destroy(
                                new Error("Reddit JSON response too large"),
                            );
                            return;
                        }
                        chunks.push(chunk);
                    });
                    res.on("end", () => {
                        try {
                            resolve(
                                JSON.parse(Buffer.concat(chunks).toString()),
                            );
                        } catch (err) {
                            reject(err);
                        }
                    });
                    res.on("error", reject);
                },
            );
            req.setTimeout(REDDIT_JSON_TIMEOUT_MS, () => {
                req.destroy(new Error("Reddit JSON request timed out"));
            });
            req.on("error", reject);
            req.end();
        });
    }

    private async fetchRedditEmbed(
        postUrl: string,
    ): Promise<RedditOEmbed | undefined> {
        try {
            const apiUrl = new URL(REDDIT_OEMBED_URL);
            apiUrl.searchParams.set("url", postUrl);
            this.log.debug(`reddit oEmbed started for ${postUrl}`);
            const res = await this.fetchImpl(apiUrl, {
                dispatcher: this.getDispatcher(),
                headers: { "user-agent": this.userAgent() },
                signal: AbortSignal.timeout(REDDIT_OEMBED_TIMEOUT_MS),
            } as RequestInit & {
                dispatcher: ReturnType<typeof createGuardedDispatcher>;
            });
            if (!res.ok) {
                throw new Error(`Reddit oEmbed returned HTTP ${res.status}`);
            }
            const embed = parseRedditOEmbed(await res.json());
            if (!embed)
                throw new Error("Reddit oEmbed returned an invalid payload");
            const image = redditOEmbedImage(embed);
            this.log.debug(
                `reddit oEmbed completed for ${postUrl} (${image ? "thumbnail" : "no thumbnail"})`,
            );
            return embed;
        } catch (err) {
            this.log.debug(
                `reddit oEmbed fetch failed for ${postUrl}: ${String(err)}; returning a text-only scrape`,
            );
            return undefined;
        }
    }

    private scrape(
        job: ActivityStream,
        cb: PlatformCallback,
        redditEmbed?: Promise<RedditOEmbed | undefined>,
        scrapeUrl = job.actor.id,
        youtubeEmbed?: Promise<YouTubeOEmbed | undefined>,
    ) {
        // Reddit serves its OG data (with the post's real preview image)
        // only to recognized embed-crawler user agents — everything else
        // gets a page without OG tags, or a 403. Facebook likewise serves
        // unrecognized scrapers a login interstitial instead of the post.
        const useCompatUserAgent =
            isRedditUrl(job.actor.id) ||
            isFacebookUrl(job.actor.id) ||
            Boolean(resolveYouTubeOEmbed(job.actor.id));
        const userAgent = useCompatUserAgent
            ? this.compatUserAgent()
            : this.userAgent();
        // The server fetches whatever URL a client puts in actor.id, so guard
        // it against SSRF and oversized responses. open-graph-scraper forwards
        // `fetchOptions` to its undici fetch; the guarded dispatcher refuses to
        // connect to private/loopback/metadata addresses (including across
        // redirect hops) and caps the response body. The escape hatch is set
        // via packageConfig — see the package README.
        const dispatcher = this.getDispatcher();
        this.log.debug(`scrape started for ${job.actor.id} via ${scrapeUrl}`);
        const options = {
            url: scrapeUrl,
            // Keep the complete Reddit oEmbed + scrape pipeline within the
            // HTTP action request deadline. OGS uses this for its Undici
            // request signal; spelling it out avoids relying on its default.
            timeout: SCRAPE_TIMEOUT_MS / 1_000,
            // open-graph-scraper *replaces* (does not merge) the default URL
            // validator settings, so we restate the defaults and only relax
            // require_tld. This lets the scraper accept TLD-less hosts such as
            // `localhost` and intranet names. Private/loopback destinations are
            // blocked at the connection layer by the guarded dispatcher above.
            urlValidatorSettings: {
                allow_fragments: true,
                allow_protocol_relative_urls: false,
                allow_query_components: true,
                allow_trailing_dot: false,
                allow_underscores: false,
                protocols: ["http", "https"],
                require_host: true,
                require_port: false,
                require_protocol: false,
                require_tld: false,
                require_valid_protocol: true,
                validate_length: true,
            },
            fetchOptions: {
                dispatcher,
                headers: { "user-agent": userAgent },
            } as RequestInit & {
                dispatcher: ReturnType<typeof createGuardedDispatcher>;
            },
        };
        // OGS's internal fetch can remain pending under the platform's Bun
        // development runtime even after its AbortSignal fires. Reddit is the
        // path where this is reproducible, so fetch that HTML with the same
        // explicit Undici client used by oEmbed and let OGS only parse it.
        const scrape = isRedditUrl(job.actor.id)
            ? this.fetchImpl(scrapeUrl, {
                  dispatcher,
                  headers: { "user-agent": userAgent },
                  signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
              } as RequestInit & {
                  dispatcher: ReturnType<typeof createGuardedDispatcher>;
              }).then(async (res) => {
                  if (!res.ok) {
                      throw new Error(
                          `metadata scrape returned HTTP ${res.status}`,
                      );
                  }
                  return ogs({ html: await res.text() });
              })
            : ogs(options);
        withDeadline(scrape, SCRAPE_TIMEOUT_MS)
            .then(async (data) => {
                const { result } = data;
                this.log.debug(`scrape completed for ${job.actor.id}`);
                const reddit = isRedditUrl(job.actor.id);
                const facebook = isFacebookUrl(job.actor.id);
                const embed = reddit ? await redditEmbed : undefined;
                const youtube = await youtubeEmbed;
                if (!reddit) job.actor.id = result.ogUrl || job.actor.id;
                // Facebook declares no og:site_name, so supply it; its video
                // titles come prefixed with localized view/reaction counts.
                const siteName =
                    result.ogSiteName ?? (facebook ? "Facebook" : undefined);
                // The og:image alt inherits the same stats prefix as the title.
                const scrapedImages = facebook
                    ? result.ogImage?.map((image) => ({
                          ...image,
                          alt: stripFacebookEngagement(image.alt),
                      }))
                    : result.ogImage;
                job.actor.name = reddit
                    ? (embed?.provider_name ?? "reddit")
                    : (siteName ?? job.actor.name ?? "");
                job.object = {
                    type: "page",
                    language: result.ogLocale,
                    title:
                        embed?.title ??
                        youtube?.title ??
                        (facebook
                            ? stripFacebookEngagement(result.ogTitle)
                            : result.ogTitle),
                    name:
                        embed?.provider_name ??
                        youtube?.provider_name ??
                        siteName,
                    description: normalizeDescription(
                        result.ogDescription || "",
                    ),
                    // Reddit increasingly returns a generic site hero as its
                    // OG image. Its optional official oEmbed thumbnail is the
                    // only image we accept for Reddit; absence means text-only.
                    image: reddit
                        ? (redditPostImages(result.ogImage) ??
                          redditOEmbedImage(embed ?? {}))
                        : scrapedImages?.length
                          ? scrapedImages
                          : youtubeOEmbedImage(youtube),
                    url: reddit ? job.actor.id : result.ogUrl,
                    // Fall back to the conventional location when the page
                    // declares no icon (vxreddit, many plain sites). It's
                    // relative on purpose: clients resolve it against the
                    // page URL, and a 404 just means no decoration.
                    favicon: result.favicon || "/favicon.ico",
                    charset: result.charset,
                };
                cb(null, job);
            })
            .catch(async (data) => {
                // open-graph-scraper rejects with { error, result }, but a
                // dispatcher/abort failure can reject with a plain Error. Handle
                // both so the real error is reported rather than throwing a
                // TypeError on `result.error`.
                const err = toError(data?.result?.error ?? data);
                this.log.debug(
                    `scrape failed for ${job.actor.id}: ${String(err)}`,
                );
                if (isRedditUrl(job.actor.id)) {
                    const embed = await redditEmbed;
                    if (embed?.title) {
                        job.actor.name = embed.provider_name || "reddit";
                        job.object = {
                            type: "page",
                            title: embed.title,
                            name: embed.provider_name || "reddit",
                            description: "",
                            image: redditOEmbedImage(embed),
                            url: job.actor.id,
                            favicon: "/favicon.ico",
                        };
                        this.log.debug(
                            `using reddit oEmbed fallback for ${job.actor.id}`,
                        );
                        cb(null, job);
                        return;
                    }
                }
                const youtube = await youtubeEmbed;
                if (youtube) {
                    job.actor.name = youtube.provider_name || "YouTube";
                    job.object = {
                        type: "page",
                        title: youtube.title,
                        name: youtube.provider_name || "YouTube",
                        description: "",
                        image: youtubeOEmbedImage(youtube),
                        url: job.actor.id,
                        favicon: "/favicon.ico",
                    };
                    this.log.debug(
                        `using youtube oEmbed fallback for ${job.actor.id}`,
                    );
                    cb(null, job);
                    return;
                }
                // Scrape failures are expected operational outcomes of
                // fetching arbitrary user-supplied URLs — slow sites time
                // out, bot-blockers return 403s, links go dead. Mark them so
                // the job handler doesn't report each one to Sentry as a
                // production error, and name the URL so any report or client
                // message is self-describing.
                cb(
                    markExpectedError(
                        new Error(
                            `metadata scrape failed for ${job.actor.id}: ${err.message}`,
                        ),
                    ),
                );
            });
    }

    cleanup(cb: PlatformCallback) {
        // Release the guarded dispatcher's pooled connections on shutdown.
        const close = this.dispatcher?.close;
        if (typeof close === "function") {
            close.call(this.dispatcher).catch(() => {});
        }
        cb();
    }
}
