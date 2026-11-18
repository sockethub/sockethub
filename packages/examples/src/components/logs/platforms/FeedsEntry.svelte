<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";

/**
 * Feeds log entries come in two types:
 *
 * 1. Collection Entry (main feed response):
 *    - Has `totalItems` property indicating number of feed items found
 *    - Actor is the feed URL that was fetched
 *    - Shows overview: "Fetched feed: https://example.com/feed.xml (5 items)"
 *
 * 2. Individual Feed Items:
 *    - Individual articles/posts from the feed
 *    - Has object.title, object.url, object.published
 *    - Shows: "Article Title" with link and date
 */

interface Props {
    id: string;
    entry: AnyActivityStream;
}

let { entry }: Props = $props();

const isCollection = $derived(entry.totalItems !== undefined);
const feedUrl = $derived(isCollection ? entry.summary : entry.object?.url);
</script>

{#if isCollection}
    <span class="text-zinc-700">{feedUrl}</span>
    <span class="text-zinc-500">· {entry.totalItems} {entry.totalItems === 1 ? "item" : "items"}</span>
{:else}
    <a rel="noreferrer" href={entry.object?.url} target="_blank">
        {entry.object?.title ||
            (typeof entry.target === "string" ? entry.target : entry.target?.id)}
    </a>
    {#if entry.object?.published}
        <span class="text-zinc-500">· {entry.object?.published.split("T")[0]}</span>
    {/if}
{/if}
