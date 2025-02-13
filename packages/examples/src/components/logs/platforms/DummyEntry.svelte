<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import Context from "./Context.svelte";
export let id: string;
export let entry: AnyActivityStream;
</script>

<Context {entry} />
<span>
    #{id}
    {typeof entry.actor === "string" ? entry.actor : entry.actor?.name || entry.actor?.id}:
</span>
<span>{entry.object?.content || ""}</span>
