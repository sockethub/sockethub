<script lang="ts">
import "../app.css";

interface Props {
    children?: import("svelte").Snippet;
}

let { children }: Props = $props();
</script>

<svelte:head>
    {@html edgeLight}
</svelte:head>

<main>
    <div>
        <div>
            <img class="m-auto" src="{base}/sockethub-logo.svg" alt="Sockethub" />
        </div>
        <div class="col-span-2 md:mt-3">
            <Nav />
        </div>
        <div class="w-full text-center">
            <ConnectStatus />
        </div>
    </div>
    <div class="pt-5">
        {@render children?.()}
    </div>
</main>
