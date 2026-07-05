/**
 * This is a platform for Sockethub implementing Atom/RSS fetching functionality.
 *
 * Developed by Nick Jennings (https://github.com/silverbucket)
 *
 * Sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about Sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

import type {
    ActivityStream,
    Logger,
    PlatformCallback,
    PlatformConfig,
    PlatformInterface,
    PlatformSchemaStruct,
    PlatformSession,
} from "@sockethub/schemas";
import { buildCanonicalContext } from "@sockethub/schemas";
import { errorMessage } from "@sockethub/util/error";
import {
    createGuardedDispatcher,
    redactUrl,
    safeFetch,
} from "@sockethub/util/net";
import htmlTags from "html-tags";
import getPodcastFromFeed, { type Episode, type Meta } from "podparse";

import PlatformSchema from "./schema.js";
import {
    ASFeedType,
    ASObjectType,
    type PlatformFeedsActivityActor,
    type PlatformFeedsActivityObject,
    type PlatformFeedsActivityStream,
} from "./types.js";

const MAX_NOTE_LENGTH = 256;
const FEEDS_CONTEXT = buildCanonicalContext(PlatformSchema.contextUrl);

const basic = /\s?<!doctype html>|(<html\b[^>]*>|<body\b[^>]*>|<x-[^>]+>)+/i;
const full = new RegExp(
    htmlTags.map((tag) => `<${tag}\\b[^>]*>`).join("|"),
    "i",
);

function isHtml(s: string): boolean {
    // limit it to a reasonable length to improve performance.
    const limitedString = s.trim().slice(0, 1000);
    return basic.test(limitedString) || full.test(s);
}

/**
 * Class: Feeds
 *
 * Handles all actions related to fetching feeds.
 *
 * Current supported feed types:
 *
 * - RSS (1 & 2)
 *
 * - Atom
 *
 * Uses the `podparse` module as a base tool fetching feeds.
 *
 * https://github.com/Tombarr/podcast-feed-parser
 *
 */
export default class Feeds implements PlatformInterface {
    id: string;
    private readonly log: Logger;
    private dispatcher?: ReturnType<typeof createGuardedDispatcher>;
    config: PlatformConfig = {
        persist: false,
        connectTimeoutMs: 5000,
    };

    /**
     * @constructor
     * @param session - a unique session object for this platform instance
     */
    constructor(session: PlatformSession) {
        this.log = session.log;
    }

    get schema(): PlatformSchemaStruct {
        return PlatformSchema;
    }

    /**
     * Stateless platforms are always ready to handle jobs.
     */
    isInitialized(): boolean {
        return true;
    }

    /**
     * Fetch feeds from specified source. Upon completion, it will send back a
     * response to the original request with a complete ActivityStreams Collection
     * containing all feed items and metadata.
     *
     * The request may carry an optional `object` with filtering parameters:
     * `since` (RFC3339 date-time; only entries published at or after this
     * instant, undated entries excluded) and `limit` (integer >= 1; cap on
     * returned entries, applied after `since`, feed order preserved).
     *
     * @param job - Activity streams object containing job data with actor.id as feed URL
     * @param done - Callback function that receives (error, ASCollection)
     * See the package README for canonical request and response payload
     * examples.
     */
    fetch(job: ActivityStream, done: PlatformCallback) {
        // ready to execute job
        const params = extractFetchParams(job.object);
        this.fetchFeed(job.actor.id, job.id, params)
            .then((results) => {
                return done(null, {
                    id: job.id || null,
                    "@context": FEEDS_CONTEXT,
                    type: "collection",
                    summary:
                        results.length > 0 && results[0]?.actor?.name
                            ? results[0].actor.name
                            : "Unknown Feed",
                    totalItems: results.length,
                    items: results,
                });
            })
            .catch(done);
    }

    /**
     * Cleanup method called when platform instance is being shut down.
     *
     * @param done - Callback function to signal completion
     */
    cleanup(done: PlatformCallback) {
        // Release the guarded dispatcher's pooled connections on shutdown.
        this.dispatcher?.close().catch(() => {});
        done();
    }

    /**
     * The SSRF-guarded undici dispatcher, created once per instance (its
     * `allowPrivateAddresses` setting comes from packageConfig, fixed before the
     * first job) and reused so connections/timers are pooled.
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

    private async makeRequest(url: string): Promise<string> {
        // safeFetch validates the scheme, routes through the guarded dispatcher
        // (blocks private/loopback destinations at the connection layer on every
        // redirect hop, caps the body), and throws on a non-2xx response.
        const res = await safeFetch(url, {
            dispatcher: this.getDispatcher(),
            timeoutMs: this.config.connectTimeoutMs,
        });
        return await res.text();
    }

    // fetches the articles from a feed, adding them to an array
    // for processing
    private async fetchFeed(
        url: string,
        id: string,
        params: FeedFetchParams = {},
    ): Promise<Array<PlatformFeedsActivityStream>> {
        this.log.debug(`fetching ${url}`);
        const res = await this.makeRequest(url);
        const feed = getPodcastFromFeed(res);
        const actor = buildFeedChannel(url, feed.meta);
        const articles = [];

        for (const [index, item] of feed.episodes.entries()) {
            try {
                const article = buildFeedStruct(actor);
                article.id = id;
                article.object = buildFeedItem(item, url);
                articles.push(article);
            } catch (err) {
                throw new Error(
                    `Failed to parse feed entry ${index + 1} from ${redactUrl(url)}: ${errorMessage(err)}`,
                    { cause: err },
                );
            }
        }
        const filtered = applyFetchFilters(articles, params);
        this.log.debug(
            `fetched ${articles.length} articles, returning ${filtered.length}`,
        );
        return filtered;
    }
}

/**
 * Optional parameters a client may attach to a `fetch` request `object`.
 * Mirrors the strict `messages.object` schema; both must stay in sync.
 */
export interface FeedFetchParams {
    since?: string;
    limit?: number;
}

/**
 * Extract the supported fetch parameters from a request `object`. Inbound
 * messages are already validated against the strict `messages` schema on the
 * server, so this only needs to read the recognized fields defensively (the
 * platform may also be called directly, e.g. in tests).
 */
export function extractFetchParams(object: unknown): FeedFetchParams {
    if (!object || typeof object !== "object") {
        return {};
    }
    const { since, limit } = object as Record<string, unknown>;
    const params: FeedFetchParams = {};
    if (typeof since === "string") {
        params.since = since;
    }
    if (typeof limit === "number" && Number.isInteger(limit) && limit >= 1) {
        params.limit = limit;
    }
    return params;
}

/**
 * Apply the `since` and `limit` fetch parameters to built feed entries.
 *
 * - `since`: drop entries published before the given instant. Entries without a
 *   parseable date (`datenum === 0`) are excluded when `since` is set, since we
 *   cannot confirm they are recent enough. An unparseable `since` is ignored.
 * - `limit`: return at most `limit` entries, preserving feed order.
 */
export function applyFetchFilters(
    articles: Array<PlatformFeedsActivityStream>,
    params: FeedFetchParams,
): Array<PlatformFeedsActivityStream> {
    let result = articles;
    if (params.since) {
        const sinceMs = Date.parse(params.since);
        if (!Number.isNaN(sinceMs)) {
            result = result.filter((article) => {
                const datenum = article.object?.datenum;
                // `datenum === 0` is the unparseable-date sentinel from
                // buildFeedItem; exclude it even when `since` is the epoch.
                return (
                    typeof datenum === "number" &&
                    datenum !== 0 &&
                    datenum >= sinceMs
                );
            });
        }
    }
    if (params.limit !== undefined && result.length > params.limit) {
        result = result.slice(0, params.limit);
    }
    return result;
}

export function buildFeedItem(
    item: Episode,
    channelUrl: string,
): PlatformFeedsActivityObject {
    const dateNum = item.pubDate ? Date.parse(item.pubDate.toString()) : NaN;
    const itemUrl = item.link;
    const idBase = itemUrl || channelUrl;
    const stableId =
        itemUrl ||
        (item.guid
            ? String(item.guid)
            : `${idBase}#${Number.isFinite(dateNum) ? dateNum : indexFallback(item)}`);
    return {
        type:
            (item.description || "").length > MAX_NOTE_LENGTH
                ? ASObjectType.ARTICLE
                : ASObjectType.NOTE,
        title: item.title || "",
        id: stableId,
        brief: item.description === item.summary ? undefined : item.summary,
        content: item.description || "",
        contentType: isHtml(item.description || "") ? "html" : "text",
        url: itemUrl || channelUrl,
        published: item.pubDate,
        datenum: Number.isFinite(dateNum) ? dateNum : 0,
    };
}

function buildFeedStruct(
    actor: PlatformFeedsActivityActor,
): PlatformFeedsActivityStream {
    return {
        "@context": FEEDS_CONTEXT,
        actor: actor,
        type: "post",
    };
}

function indexFallback(item: Episode): string {
    return `${item.title || "item"}-${item.pubDate || "unknown"}`;
}

function buildFeedChannel(url: string, meta: Meta): PlatformFeedsActivityActor {
    return {
        id: url,
        type: ASFeedType.FEED_CHANNEL,
        name: meta.title ? meta.title : meta.link ? meta.link : url,
        link: meta.link || url,
        description: meta.description ? meta.description : undefined,
        image: meta.image?.url || undefined,
        categories: meta.category ? meta.category : [],
        language: meta.language ? meta.language : undefined,
        // podparse's typings declare `author` as an object, but its RSS
        // mapping emits the raw <author> text as a string; handle both shapes.
        author:
            (typeof meta.author === "string"
                ? meta.author
                : meta.author?.name) || undefined,
    };
}
