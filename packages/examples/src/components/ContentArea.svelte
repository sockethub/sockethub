<script lang="ts">
interface Props {
    children?: import("svelte").Snippet;
}

let { children }: Props = $props();
</script>

<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {@render children?.()}
</div>
