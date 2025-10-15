<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import Context from "./Context.svelte";

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

let { id, entry }: Props = $props();

// Check if this is a collection/feed response (has totalItems) or individual item
const isCollection = entry.totalItems !== undefined;

// For feed collections, the URL is in the summary field
// For individual items, the URL is in object.url (link to the article)
const feedUrl = isCollection ? entry.summary : entry.object?.url;

const actorName =
    typeof entry.actor === "string"
        ? entry.actor
        : entry.actor?.name || entry.actor?.id;
</script>

<Context {entry} />

{#if isCollection}
    <!-- Collection Entry: Show the feed URL and item count -->
    <span class="font-medium">📰 Fetched feed:</span>
    <span>{feedUrl}</span>
    <span class="text-gray-500">({entry.totalItems} {entry.totalItems === 1 ? 'item' : 'items'})</span>
{:else}
    <!-- Individual Feed Item: Show article title and details -->
    <span class="text-gray-500">#{id}</span>
    {#if actorName}
        <span>{actorName}:</span>
    {/if}
    <span>
        <a rel="noreferrer" href={entry.object?.url} target="_blank" class="text-blue-600 hover:text-blue-800 underline">
            {#if entry.object?.contentType === "html"}
                {@html entry.object?.title}
            {:else}
                {entry.object?.title || typeof entry.target === "string" ? entry.target : entry.target?.id}
            {/if}
        </a>
    </span>
    {#if entry.object?.published}
        <span class="text-gray-500 text-xs italic">{entry.object?.published.split("T")[0]}</span>
    {/if}
{/if}
