<script lang="ts">
import { connected } from "$lib/sockethub";

interface Props {
    disabled?: boolean;
    buttonAction: () => Promise<void>;
    children?: import("svelte").Snippet;
}

let { children, disabled, buttonAction }: Props = $props();
const isDisabled = $derived(!$connected ? true : !!disabled);
</script>

<button
    onclick={buttonAction}
    class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 {isDisabled ? 'bg-gray-400 hover:bg-gray-400' : ''}"
    disabled={isDisabled}>{@render children?.()}</button
>
