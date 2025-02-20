<script lang="ts">
import { connected } from "$lib/sockethub";

interface Props {
    disabled: boolean;
    buttonAction: () => Promise<void>;
    children?: import("svelte").Snippet;
}

let { children, disabled, buttonAction }: Props = $props();
const isDisabled = $derived(!$connected ? true : !!disabled);
</script>

<button
    onclick={buttonAction}
    class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded my-2 mx-4"
    disabled={isDisabled}>{@render children?.()}</button
>
