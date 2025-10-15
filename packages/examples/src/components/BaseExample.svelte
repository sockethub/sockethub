<script lang="ts">
import Intro from "./Intro.svelte";
import Logger from "./logs/Logger.svelte";

interface Props {
    title: string;
    description?: string;
    children?: import("svelte").Snippet;
}

let { title, description, children }: Props = $props();
</script>

<Intro {title}>
    <title>{title}</title>
    {#if description}
        <p>{description}</p>
    {/if}
</Intro>

<div class="space-y-6">
    {@render children?.()}
</div>

<Logger />