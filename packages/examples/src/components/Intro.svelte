<script lang="ts">
import ContentArea from "./ContentArea.svelte";

interface Props {
    title: string;
    children?: import("svelte").Snippet;
}

let { children, title }: Props = $props();
</script>

<ContentArea>
    <h1>{title}</h1>
    <div class="px-4 py-2">
        {@render children?.()}
    </div>
</ContentArea>
