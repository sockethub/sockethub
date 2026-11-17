<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";

interface Props {
    id: string;
    entry: AnyActivityStream;
}

let { entry }: Props = $props();
const actor = $derived(
    typeof entry.actor === "string"
        ? entry.actor
        : entry.actor?.name || entry.actor?.id,
);
</script>

<span class="text-zinc-400">{actor}:</span>
<span class="text-zinc-700">{entry.object?.content || "(empty)"}</span>
