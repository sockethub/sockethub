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

/** Map a canonical Reddit post URL to Reddit's official media-enabled embed. */
export function resolveRedditEmbed(url: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (!REDDIT_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    if (
        !/^\/(?:r|user)\/[^/]+\/comments\/[^/]+(?:\/|$)/.test(parsed.pathname)
    ) {
        return null;
    }
    const embed = new URL(parsed.pathname, "https://embed.reddit.com");
    embed.searchParams.set("embed", "true");
    embed.searchParams.set("showmedia", "true");
    return embed.href;
}

/** Map a canonical Reddit post URL to old.reddit.com's public JSON endpoint. */
export function resolveRedditJson(url: string): string | null {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }
    if (!REDDIT_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    const match = parsed.pathname.match(
        /^\/(?:r|user)\/[^/]+\/comments\/[^/]+(?:\/[^/]*)?\/?$/,
    );
    if (!match) return null;
    const json = new URL(
        `${parsed.pathname.replace(/\/$/, "")}.json`,
        "https://old.reddit.com",
    );
    json.searchParams.set("raw_json", "1");
    return json.href;
}

export interface RedditPost {
    title: string;
    selftext?: string;
    url?: string;
    url_overridden_by_dest?: string;
}

/** Validate and extract the post object from Reddit's listing response. */
export function parseRedditPost(value: unknown): RedditPost | null {
    if (!Array.isArray(value)) return null;
    const post = (
        value[0] as { data?: { children?: Array<{ data?: unknown }> } }
    )?.data?.children?.[0]?.data;
    if (!post || typeof post !== "object" || Array.isArray(post)) return null;
    const data = post as Record<string, unknown>;
    if (typeof data.title !== "string" || !data.title) return null;
    for (const key of ["selftext", "url", "url_overridden_by_dest"]) {
        if (data[key] !== undefined && typeof data[key] !== "string")
            return null;
    }
    return data as unknown as RedditPost;
}

/** Select only a direct Reddit-hosted image belonging to the post. */
export function redditPostImage(post: RedditPost): PageObject["image"] {
    for (const candidate of [post.url_overridden_by_dest, post.url]) {
        if (!candidate) continue;
        try {
            const url = new URL(candidate);
            if (
                ["i.redd.it", "preview.redd.it"].includes(
                    url.hostname.toLowerCase(),
                )
            ) {
                return [{ url: url.href }];
            }
        } catch {
            // Try the next candidate.
        }
    }
    return undefined;
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

/** Validate the subset of Reddit's untrusted oEmbed JSON that we consume. */
export function parseRedditOEmbed(value: unknown): RedditOEmbed | null {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    const embed = value as Record<string, unknown>;
    for (const key of [
        "title",
        "author_name",
        "provider_name",
        "thumbnail_url",
    ]) {
        if (embed[key] !== undefined && typeof embed[key] !== "string") {
            return null;
        }
    }
    for (const key of ["thumbnail_width", "thumbnail_height"]) {
        if (
            embed[key] !== undefined &&
            (typeof embed[key] !== "number" ||
                !Number.isFinite(embed[key]) ||
                embed[key] < 0)
        ) {
            return null;
        }
    }
    return embed as RedditOEmbed;
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

/** Keep only Reddit-hosted post media, excluding branding/share-card images. */
export function redditPostImages(
    images: PageObject["image"],
): PageObject["image"] | undefined {
    const allowedHosts = new Set([
        "i.redd.it",
        "preview.redd.it",
        "external-preview.redd.it",
    ]);
    const filtered = images?.filter((image) => {
        try {
            return allowedHosts.has(new URL(image.url).hostname.toLowerCase());
        } catch {
            return false;
        }
    });
    return filtered?.length ? filtered : undefined;
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
        article?: {
            title?: string;
            preview_text?: string;
            cover_media?: {
                media_info?: {
                    original_img_url?: string;
                    original_img_width?: number;
                    original_img_height?: number;
                };
            };
            content?: {
                blocks?: Array<{
                    text?: string;
                    type?: string;
                }>;
            };
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
    const article = tweet.article;
    const articleBody = article?.content?.blocks
        ?.map((block) =>
            block?.type !== "atomic" && typeof block?.text === "string"
                ? block.text.trim()
                : "",
        )
        .filter(Boolean)
        .join("\n\n");
    const title =
        (typeof article?.title === "string" && article.title) ||
        (author.name && author.screen_name
            ? `${author.name} (@${author.screen_name}) on X`
            : (author.name ?? "Post on X"));
    const photo = tweet.media?.photos?.[0];
    const video = tweet.media?.videos?.[0];
    const articleImage = article?.cover_media?.media_info;
    const imageUrl =
        articleImage?.original_img_url ?? photo?.url ?? video?.thumbnail_url;
    const page: PageObject = {
        type: "page",
        title,
        name: "X (formerly Twitter)",
        description: normalizeDescription(
            articleBody ||
                (typeof article?.preview_text === "string"
                    ? article.preview_text
                    : "") ||
                tweet.text ||
                "",
        ),
        url: tweet.url,
        // The API bypasses the page scrape, so no favicon comes back with
        // it — supply the canonical one so clients can decorate the card.
        favicon: "https://x.com/favicon.ico",
    };
    if (imageUrl) {
        page.image = [
            {
                url: imageUrl,
                width:
                    articleImage?.original_img_width ??
                    photo?.width ??
                    video?.width,
                height:
                    articleImage?.original_img_height ??
                    photo?.height ??
                    video?.height,
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
