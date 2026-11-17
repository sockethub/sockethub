<script lang="ts">
import { connected } from "$lib/sockethub";
import Icon from "./Icon.svelte";

interface Props {
    disabled?: boolean;
    variant?: "primary" | "secondary" | "danger";
    buttonAction: () => Promise<void>;
    children?: import("svelte").Snippet;
}

let { children, disabled, variant = "primary", buttonAction }: Props = $props();
const isDisabled = $derived(!$connected ? true : !!disabled);
</script>

<button
    type="button"
    onclick={buttonAction}
    class="btn btn-{variant}"
    disabled={isDisabled}
    title={!$connected ? "Waiting for the connection to Sockethub" : undefined}
>
    {#if !$connected && isDisabled}
        <Icon name="plug" class="size-4" />
        <span>Not Connected</span>
    {:else}
        {@render children?.()}
    {/if}
</button>
