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
const target = $derived(
    typeof entry.target === "string"
        ? entry.target
        : entry.target?.name || entry.target?.id,
);
const content = $derived(
    typeof entry.object?.content === "string" ? entry.object.content : "",
);
</script>

<span class="text-zinc-700">{actor}</span>
{#if target}
    <span class="text-zinc-400">→</span>
    <span class="text-zinc-700">{target}</span>
{/if}
{#if content}
    <span class="text-zinc-400">:</span>
    <span class="text-zinc-600">{content}</span>
{/if}
