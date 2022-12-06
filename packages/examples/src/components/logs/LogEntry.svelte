<li>
  <button on:click="{buttonAction}"
          data-modal-toggle="defaultModal"
          class="hover:bg-blue-400 bg-blue-300 text-black py-0 px-2 rounded mr-3 mb-1">view log</button>
  {#if entry.context === "dummy"}
    <DummyEntry id={id} entry={entry} />
  {:else if entry.context === "feeds"}
    <FeedsEntry id={id} entry={entry} />
  {:else if entry.context === "irc"}
    <IrcEntry id={id} entry={entry} />
  {:else}
    <span>Unknown LoggerEntry platform received : {entry.context}</span>
  {/if}
  {#if entry.error}
  <p>
    <span class="ml-5 text-red-500">{entry.error}</span>
  </p>
  {/if}
</li>

<script lang="ts">
  import DummyEntry from "./platforms/DummyEntry.svelte";
  import FeedsEntry from "./platforms/FeedsEntry.svelte";
  import IrcEntry from "./platforms/IrcEntry.svelte";
  export let id;
  export let entry;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  export let buttonAction = () => {};
</script>
