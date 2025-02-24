<script lang="ts">
interface Props {
    children?: import("svelte").Snippet;
}

let { children }: Props = $props();
</script>

<div class="col-start-3 col-end-7">
    {@render children?.()}
</div>
