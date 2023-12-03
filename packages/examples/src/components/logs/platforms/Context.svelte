<script lang="ts">
  import type {AnyActivityStream} from "$lib/sockethub.js";

  export let entry: AnyActivityStream;
</script>

<span>[{entry.context}:{entry.type}]</span>
