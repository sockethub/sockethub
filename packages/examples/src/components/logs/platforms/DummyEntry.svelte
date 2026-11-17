<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";

interface Props {
    id: string;
    entry: AnyActivityStream;
}

let { entry }: Props = $props();
</script>

<span class="text-zinc-700">{entry.object?.content || "(empty)"}</span>
