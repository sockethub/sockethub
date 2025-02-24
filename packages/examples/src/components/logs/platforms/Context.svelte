<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub.js";

interface Props {
    entry: AnyActivityStream;
}

let { entry }: Props = $props();
</script>

<span>[{entry.context}:{entry.type}]</span>
