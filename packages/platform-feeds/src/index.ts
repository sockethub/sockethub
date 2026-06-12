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

import { lookup } from "node:dns/promises";
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

// Cap the amount of data read from a single feed response. AbortSignal.timeout
// bounds how long a request may take; this bounds how many bytes it may return,
// guarding against unbounded (or lying-Content-Length) bodies exhausting memory.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

// Bound how many redirects we follow. Each hop is re-validated (scheme + DNS)
// to prevent redirect-based DNS rebinding past the SSRF guard.
const MAX_REDIRECTS = 5;

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

function isRedirect(status: number): boolean {
    return (
        status === 301 ||
        status === 302 ||
        status === 303 ||
        status === 307 ||
        status === 308
    );
}

/**
 * Returns true if `ip` is a loopback, private, link-local, or otherwise
 * non-public address that should not be reachable by a server fetching
 * client-supplied URLs (SSRF defense). Handles IPv4, IPv6, and IPv4-mapped
 * IPv6 addresses.
 */
export function isBlockedAddress(ip: string): boolean {
    const addr = ip.trim().toLowerCase();

    // IPv4-mapped IPv6 (e.g. ::ffff:169.254.169.254) -> apply IPv4 rules.
    const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) {
        return isBlockedIpv4(mapped[1]);
    }

    if (addr.includes(":")) {
        return isBlockedIpv6(addr);
    }

    return isBlockedIpv4(addr);
}

function isBlockedIpv4(ip: string): boolean {
    const parts = ip.split(".").map((p) => Number(p));
    if (
        parts.length !== 4 ||
        parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)
    ) {
        // Not a parseable IPv4 literal; block conservatively.
        return true;
    }
    const [a, b] = parts;
    // 0.0.0.0/8 ("this network", commonly routes to localhost)
    if (a === 0) return true;
    // 127.0.0.0/8 loopback
    if (a === 127) return true;
    // 10.0.0.0/8 private
    if (a === 10) return true;
    // 172.16.0.0/12 private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 private
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 link-local (incl. 169.254.169.254 cloud metadata)
    if (a === 169 && b === 254) return true;
    return false;
}

function isBlockedIpv6(ip: string): boolean {
    // Strip zone index (e.g. fe80::1%eth0).
    const addr = ip.split("%")[0];
    // ::1 loopback (and :: unspecified).
    if (addr === "::1" || addr === "::") return true;
    // fc00::/7 unique-local (fc.. or fd..).
    if (/^f[cd][0-9a-f]{0,2}:/.test(addr)) return true;
    // fe80::/10 link-local (fe8, fe9, fea, feb).
    if (/^fe[89ab][0-9a-f]?:/.test(addr)) return true;
    return false;
}

/**
 * Validates that `url` is an http(s) URL whose hostname resolves only to
 * public addresses. Throws a clear Error otherwise. Used before every fetch
 * (including each redirect hop) to defend against SSRF.
 */
export async function assertUrlAllowed(url: string): Promise<void> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`feed request blocked: invalid URL ${url}`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(
            `feed request blocked: unsupported scheme ${parsed.protocol} for ${url}`,
        );
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

    // If the host is already an IP literal, check it directly.
    if (isBlockedAddress(hostname)) {
        throw new Error(
            `feed request blocked: destination ${hostname} is not a public address (${url})`,
        );
    }

    // Otherwise resolve all records and reject if ANY is private/loopback.
    let addresses: Array<{ address: string }>;
    try {
        addresses = await lookup(hostname, { all: true });
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
            `feed request blocked: could not resolve ${hostname} (${detail})`,
        );
    }
    for (const { address } of addresses) {
        if (isBlockedAddress(address)) {
            throw new Error(
                `feed request blocked: ${hostname} resolves to non-public address ${address} (${url})`,
            );
        }
    }
}

/**
 * Reads a response body, enforcing MAX_RESPONSE_BYTES. Rejects up front on an
 * oversized Content-Length and defensively while streaming (in case the header
 * is missing or lies). Returns the decoded body as a string.
 */
async function readCappedBody(res: Response, url: string): Promise<string> {
    const contentLength = res.headers.get("content-length");
    if (contentLength) {
        const declared = Number(contentLength);
        if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
            throw new Error(
                `feed request failed: response too large (${declared} bytes) for ${url}`,
            );
        }
    }

    if (!res.body) {
        return await res.text();
    }

    const reader = res.body.getReader();
    const chunks: Array<Uint8Array> = [];
    let total = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                total += value.byteLength;
                if (total > MAX_RESPONSE_BYTES) {
                    await reader.cancel();
                    throw new Error(
                        `feed request failed: response exceeded ${MAX_RESPONSE_BYTES} bytes for ${url}`,
                    );
                }
                chunks.push(value);
            }
        }
    } finally {
        reader.releaseLock();
    }

    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
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
     * Currently, no cleanup required for feeds platform.
     *
     * @param done - Callback function to signal completion
     */
    cleanup(done: PlatformCallback) {
        done();
    }

    private async makeRequest(url: string): Promise<string> {
        let currentUrl = url;
        let signal: AbortSignal | undefined;
        if (this.config.connectTimeoutMs) {
            signal = AbortSignal.timeout(this.config.connectTimeoutMs);
        }

        for (let hop = 0; ; hop++) {
            // Validate scheme + resolve DNS and block private destinations
            // before every fetch, including each redirect hop.
            await assertUrlAllowed(currentUrl);

            const opts: RequestInit = { redirect: "manual" };
            if (signal) {
                opts.signal = signal;
            }
            const res = await fetch(currentUrl, opts);

            if (isRedirect(res.status)) {
                if (hop >= MAX_REDIRECTS) {
                    throw new Error(
                        `feed request failed: too many redirects for ${url}`,
                    );
                }
                const location = res.headers.get("location");
                if (!location) {
                    throw new Error(
                        `feed request failed: ${res.status} redirect without Location for ${currentUrl}`,
                    );
                }
                // Resolve relative redirects against the current URL.
                currentUrl = new URL(location, currentUrl).toString();
                continue;
            }

            if (!res.ok) {
                throw new Error(
                    `feed request failed: ${res.status} ${res.statusText} for ${url}`,
                );
            }

            return await readCappedBody(res, currentUrl);
        }
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
                const detail = err instanceof Error ? err.message : String(err);
                throw new Error(
                    `Failed to parse feed entry ${index + 1} from ${url}: ${detail}`,
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
