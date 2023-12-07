<script lang="ts">
  import Context from "./Context.svelte";
  import type { AnyActivityStream } from "$lib/sockethub";
  export let id: string;
  export let entry: AnyActivityStream;
</script>

<Context {entry} />
<span
  >#{id}
  {typeof entry.actor === "string" ? entry.actor : entry.actor?.name || entry.actor?.id}</span
>
