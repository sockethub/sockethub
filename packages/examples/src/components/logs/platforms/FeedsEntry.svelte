<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import Context from "./Context.svelte";
export let id: string;
export let entry: AnyActivityStream;
</script>

<Context {entry} />
<span
    >#{id}
    {typeof entry.actor === "string" ? entry.actor : entry.actor?.name || entry.actor?.id}:</span
>
<span>
    <a rel="noreferrer" href={entry.object?.url} target="_blank">
        {#if entry.object?.contentType === "html"}
            {@html entry.object?.title}
        {:else}
            {entry.object?.title || typeof entry.target === "string"
                ? entry.target
                : entry.target?.id}
        {/if}
    </a>
</span>
{#if entry.object?.published}
    <span class="italic">{entry.object?.published.split("T")[0]}</span>
{/if}
