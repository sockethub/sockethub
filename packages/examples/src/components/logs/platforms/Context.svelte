<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub.js";
import { platformIdFromContext } from "$lib/sockethub.js";

interface Props {
    entry: AnyActivityStream;
}

let { entry }: Props = $props();
const platform = $derived(platformIdFromContext(entry["@context"]));
</script>

<span>[{platform ?? "unknown"}:{entry.type}]</span>
