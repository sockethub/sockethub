<script lang="ts" module>
/**
 * Link-preview card for a metadata platform `page` object: the thumbnail,
 * favicon, site name, title, description, and page URL, rendered the way
 * a chat client would display the fetched link.
 */
export interface PageImage {
    url: string;
    alt?: string;
    type?: string;
    width?: string | number;
    height?: string | number;
}

export interface PageVideo {
    url: string;
    thumbnail?: string;
    width?: number;
    height?: number;
    duration?: number;
}

export interface PageObject {
    type: "page";
    language?: string;
    title?: string;
    name?: string;
    description?: string;
    image?: PageImage[];
    video?: PageVideo;
    url?: string;
    favicon?: string;
    charset?: string;
}

/** True when `value` looks like a metadata platform page object. */
export function isPageObject(value: unknown): value is PageObject {
    return (
        typeof value === "object" &&
        value !== null &&
        (value as { type?: unknown }).type === "page"
    );
}
</script>

<script lang="ts">
interface Props {
    page: PageObject;
}

let { page }: Props = $props();

/** Resolve a possibly relative favicon (e.g. `/favicon.ico`) against the page URL. */
const faviconUrl = $derived.by(() => {
    if (!page.favicon) return undefined;
    try {
        return new URL(page.favicon, page.url).href;
    } catch {
        return undefined;
    }
});

const image = $derived(page.image?.[0]);
const poster = $derived(page.video?.thumbnail ?? image?.url);
const host = $derived.by(() => {
    if (!page.url) return "";
    try {
        return new URL(page.url).hostname;
    } catch {
        return page.url;
    }
});

// Track the failed URL rather than a flag so a new page (the activity
// log modal reuses this component) is not stuck showing the fallback.
let failedFavicon: string | undefined = $state();
let failedImage: string | undefined = $state();
const faviconFailed = $derived(
    faviconUrl !== undefined && failedFavicon === faviconUrl,
);
const imageFailed = $derived(
    image !== undefined && failedImage === image.url,
);
</script>

<div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden max-w-xl">
    {#if page.video?.url}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
            class="w-full max-h-80 bg-black"
            controls
            preload="metadata"
            src={page.video.url}
            poster={poster}
        ></video>
    {:else if image && !imageFailed}
        <img
            class="w-full max-h-80 object-cover bg-gray-100"
            src={image.url}
            alt={image.alt ?? page.title ?? ""}
            onerror={() => (failedImage = image?.url)}
        />
    {:else}
        <div class="w-full h-24 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            No preview image
        </div>
    {/if}

    <div class="p-4 space-y-1">
        <div class="flex items-center space-x-2 text-xs text-gray-500 uppercase tracking-wide">
            {#if faviconUrl && !faviconFailed}
                <img
                    class="w-4 h-4"
                    src={faviconUrl}
                    alt=""
                    onerror={() => (failedFavicon = faviconUrl)}
                />
            {/if}
            <span>{page.name || host}</span>
        </div>
        {#if page.title}
            <h4 class="font-semibold text-gray-900 whitespace-pre-line">{page.title}</h4>
        {/if}
        {#if page.description}
            <p class="text-sm text-gray-600 whitespace-pre-line line-clamp-6">{page.description}</p>
        {/if}
        {#if page.url}
            <a
                class="block text-xs text-indigo-600 hover:text-indigo-800 truncate"
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
            >{page.url}</a>
        {/if}
    </div>
</div>
