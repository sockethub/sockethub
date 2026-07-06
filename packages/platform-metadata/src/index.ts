import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSession,
} from "@sockethub/schemas";
import { toError } from "@sockethub/util/error";
import { createGuardedDispatcher } from "@sockethub/util/net";
import ogs from "open-graph-scraper";
import packageJson from "../package.json" with { type: "json" };
import {
    type FxTwitterStatus,
    isRedditUrl,
    resolveTwitterStatus,
    tweetToPageObject,
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

export default class Metadata implements PlatformInterface {
    private readonly log: Logger;
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
        this.scrape(job, cb);
    }

    private async fetchTweet(
        apiUrl: string,
        job: ActivityStream,
        cb: PlatformCallback,
    ) {
        try {
            const res = await globalThis.fetch(apiUrl, {
                // biome-ignore lint/suspicious/noExplicitAny: undici fetch accepts a dispatcher
                dispatcher: this.getDispatcher(),
                headers: { "user-agent": this.userAgent() },
                signal: AbortSignal.timeout(TWEET_API_TIMEOUT_MS),
            } as any);
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

    private scrape(job: ActivityStream, cb: PlatformCallback) {
        // Reddit serves its OG data (with the post's real preview image)
        // only to recognized embed-crawler user agents — everything else
        // gets a page without OG tags, or a 403.
        const userAgent = isRedditUrl(job.actor.id)
            ? this.compatUserAgent()
            : this.userAgent();
        // The server fetches whatever URL a client puts in actor.id, so guard
        // it against SSRF and oversized responses. open-graph-scraper forwards
        // `fetchOptions` to its undici fetch; the guarded dispatcher refuses to
        // connect to private/loopback/metadata addresses (including across
        // redirect hops) and caps the response body. The escape hatch is set
        // via packageConfig — see the package README.
        const dispatcher = this.getDispatcher();
        ogs({
            url: job.actor.id,
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
            // biome-ignore lint/suspicious/noExplicitAny: ogs fetchOptions dispatcher
            fetchOptions: {
                dispatcher,
                headers: { "user-agent": userAgent },
            } as any,
        })
            .then((data) => {
                const { result } = data;
                job.actor.id = result.ogUrl || job.actor.id;
                job.actor.name = result.ogSiteName || job.actor.name || "";
                job.object = {
                    type: "page",
                    language: result.ogLocale,
                    title: result.ogTitle,
                    name: result.ogSiteName,
                    description: result.ogDescription || "",
                    image: result.ogImage,
                    url: result.ogUrl,
                    // Fall back to the conventional location when the page
                    // declares no icon (vxreddit, many plain sites). It's
                    // relative on purpose: clients resolve it against the
                    // page URL, and a 404 just means no decoration.
                    favicon: result.favicon || "/favicon.ico",
                    charset: result.charset,
                };
                cb(null, job);
            })
            .catch((data) => {
                // open-graph-scraper rejects with { error, result }, but a
                // dispatcher/abort failure can reject with a plain Error. Handle
                // both so the real error is reported rather than throwing a
                // TypeError on `result.error`.
                cb(toError(data?.result?.error ?? data));
            });
    }

    cleanup(cb: PlatformCallback) {
        // Release the guarded dispatcher's pooled connections on shutdown.
        this.dispatcher?.close().catch(() => {});
        cb();
    }
}
