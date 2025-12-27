<script lang="ts">
interface Props {
    disabled?: boolean;
    buttonAction: () => Promise<void>;
    children?: import("svelte").Snippet;
}

let { children, disabled, buttonAction }: Props = $props();
const _isDisabled = $derived(!$connected ? true : !!disabled);
</script>

<button
    onclick={buttonAction}
    class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold border border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed transition-all duration-200 {
        isDisabled && !$connected 
            ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100' 
            : isDisabled 
                ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100' 
                : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    }"
    disabled={isDisabled}
    title={!$connected ? 'Please connect to Sockethub first' : ''}
>
    {#if !$connected && isDisabled}
        <div class="flex items-center space-x-2">
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75A11.959 11.959 0 0112 2.704z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span class="text-xs">Not Connected</span>
        </div>
    {:else}
        {@render children?.()}
    {/if}
</button>
