<Context entry={entry} />
<span>#{id} {entry.actor?.name || entry.actor?.id || entry.actor}</span>

<script lang="ts">
  import Context from "./Context.svelte";
  export let id;
  export let entry;
</script>
