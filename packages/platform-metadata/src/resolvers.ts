/**
 * Site-specific URL resolution for pages that don't serve useful Open Graph
 * data to scrapers.
 *
 * Some large platforms return a generic banner image (X/Twitter), serve
 * their Open Graph data only to recognized embed crawlers (Reddit), or
 * hide post media behind a login (Facebook). Two of those have working
 * strategies:
 *
 * - X/Twitter → FxTwitter's JSON API (api.fxtwitter.com), built for embed
 *   previews, returns the tweet text plus direct photo/video URLs.
 * - Reddit → the regular scrape works, but only when presented with an
 *   embed-crawler user agent (see COMPAT_USER_AGENT in index.ts).
 *
 * These are pure URL matchers/mappers — the platform decides what to do
 * with the resolution (call a JSON API vs. pick a scrape user agent).
 */

/** Hosts that serve X/Twitter statuses. */
const TWITTER_HOSTS = new Set([
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com",
    "x.com",
    "www.x.com",
    "mobile.x.com",
]);

/** Hosts that serve Reddit posts. */
const REDDIT_HOSTS = new Set([
    "reddit.com",
    "www.reddit.com",
    "old.reddit.com",
    "new.reddit.com",
    "np.reddit.com",
]);

/**
 * Match an X/Twitter status URL and return the FxTwitter API URL for it,
 * or null when the URL isn't a status page (profiles, search, home feed —
 * those go through the normal OG scrape).
 *
 * Handles `/<user>/status/<id>` and the `/i/web/status/<id>` share form.
 */
export function resolveTwitterStatus(url: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (!TWITTER_HOSTS.has(parsed.hostname.toLowerCase())) {
        return null;
    }
    const match = parsed.pathname.match(
        /^\/(?:i\/web|[A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d+)/,
    );
    if (!match) {
        return null;
    }
    return `https://api.fxtwitter.com/status/${match[1]}`;
}

/**
 * True for Reddit URLs (including redd.it short links). Reddit serves its
 * Open Graph tags — with the post's real preview image — only to
 * recognized embed-crawler user agents; everything else gets a page with
 * no OG data (or an outright 403 from datacenter addresses).
 */
export function isRedditUrl(url: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    const host = parsed.hostname.toLowerCase();
    return REDDIT_HOSTS.has(host) || host === "redd.it";
}

/** Subset of Reddit's oEmbed response used for link previews. */
export interface RedditOEmbed {
    title?: string;
    author_name?: string;
    provider_name?: string;
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
}

/**
 * Convert Reddit's optional oEmbed thumbnail into the platform image shape.
 * A missing or malformed thumbnail deliberately means "no image": Reddit's
 * scraped Open Graph image may be a generic site hero rather than post media.
 */
export function redditOEmbedImage(
    embed: RedditOEmbed,
): PageObject["image"] | undefined {
    if (!embed?.thumbnail_url) {
        return undefined;
    }
    let url: URL;
    try {
        url = new URL(embed.thumbnail_url);
    } catch {
        return undefined;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return undefined;
    }
    return [
        {
            url: url.href,
            width: embed.thumbnail_width,
            height: embed.thumbnail_height,
        },
    ];
}

/**
 * Make scraped plain text readable without flattening intentional structure.
 * Preserve line breaks and paragraphs, but remove HTML indentation and cap
 * excessive vertical whitespace at one blank line.
 */
export function normalizeDescription(value: string): string {
    return value
        .replace(/\r\n?/g, "\n")
        .replace(/\u00a0/g, " ")
        .split("\n")
        .map((line) => line.replace(/[\t\p{Zs}]+/gu, " ").trim())
        .join("\n")
        .replace(/^\n+|\n+$/g, "")
        .replace(/\n{3,}/g, "\n\n");
}

/** Subset of the FxTwitter status API response the platform consumes. */
export interface FxTwitterStatus {
    code: number;
    message?: string;
    tweet?: {
        url?: string;
        text?: string;
        author?: {
            name?: string;
            screen_name?: string;
        };
        media?: {
            photos?: Array<{
                url?: string;
                width?: number;
                height?: number;
            }>;
            videos?: Array<{
                url?: string;
                thumbnail_url?: string;
                width?: number;
                height?: number;
                duration?: number;
            }>;
        };
    };
}

/** The `object` payload shape the metadata platform responds with. */
export interface PageObject {
    type: "page";
    language?: string;
    title?: string;
    name?: string;
    description?: string;
    image?: Array<{
        url: string;
        type?: string;
        width?: string | number;
        height?: string | number;
    }>;
    video?: {
        url: string;
        thumbnail?: string;
        width?: number;
        height?: number;
        duration?: number;
    };
    url?: string;
    favicon?: string;
    charset?: string;
}

/**
 * Map an FxTwitter API response onto the platform's page object. The
 * preview image is the post's own media — first photo, else the video
 * thumbnail — never the generic site banner. Returns null when the API
 * reports anything but success (the caller falls back to the OG scrape).
 */
export function tweetToPageObject(status: FxTwitterStatus): PageObject | null {
    const tweet = status?.tweet;
    if (status?.code !== 200 || !tweet) {
        return null;
    }
    const author = tweet.author ?? {};
    const title =
        author.name && author.screen_name
            ? `${author.name} (@${author.screen_name}) on X`
            : (author.name ?? "Post on X");
    const photo = tweet.media?.photos?.[0];
    const video = tweet.media?.videos?.[0];
    const imageUrl = photo?.url ?? video?.thumbnail_url;
    const page: PageObject = {
        type: "page",
        title,
        name: "X (formerly Twitter)",
        description: normalizeDescription(tweet.text ?? ""),
        url: tweet.url,
        // The API bypasses the page scrape, so no favicon comes back with
        // it — supply the canonical one so clients can decorate the card.
        favicon: "https://x.com/favicon.ico",
    };
    if (imageUrl) {
        page.image = [
            {
                url: imageUrl,
                width: photo?.width ?? video?.width,
                height: photo?.height ?? video?.height,
            },
        ];
    }
    if (video?.url) {
        page.video = {
            url: video.url,
            thumbnail: video.thumbnail_url,
            width: video.width,
            height: video.height,
            duration: video.duration,
        };
    }
    return page;
}
