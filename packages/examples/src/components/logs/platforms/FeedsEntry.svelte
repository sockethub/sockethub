<script lang="ts">
  import Context from "./Context.svelte";
  export let id;
  export let entry;
</script>

<Context {entry} />
<span>#{id} {entry.actor?.name || entry.actor?.id || entry.actor}:</span>
<span>
  <a rel="noreferrer" href={entry.object?.url} target="_blank">
    {#if entry.object?.contentType === "html"}
      {@html entry.object?.title}
    {:else}
      {entry.object?.title || entry.target?.id}
    {/if}
  </a>
</span>
{#if entry.object?.published}
  <span class="italic">{entry.object?.published.split("T")[0]}</span>
{/if}
