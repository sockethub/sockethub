<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import Context from "./Context.svelte";

interface Props {
    id: string;
    entry: AnyActivityStream;
}

let { id, entry }: Props = $props();
</script>

<Context {entry} />
<span
    >#{id}
    {typeof entry.actor === "string" ? entry.actor : entry.actor?.name || entry.actor?.id}</span
>
