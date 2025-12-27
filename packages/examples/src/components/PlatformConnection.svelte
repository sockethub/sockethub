<script lang="ts">
import type { SockethubStateStore } from "$lib/types";

/**
 * Standardized connection button for Sockethub platforms.
 * Handles connection state display and provides consistent connect/disconnect UI.
 *
 * The button text changes based on state:
 * - "Connect" (initial state)
 * - "Connecting" (during connection attempt)
 * - "Connected" (successfully connected)
 *
 * @example
 * ```svelte
 * <PlatformConnection
 *   {sockethubState}
 *   {connecting}
 *   onConnect={connectToIRC}
 * />
 * ```
 */
interface Props {
    /** Writable store containing platform connection state */
    sockethubState: SockethubStateStore;
    /** True when a connection attempt is in progress */
    connecting: boolean;
    /** Function to call when user clicks connect button */
    onConnect: () => void | Promise<void>;
    /** Optional additional disabled condition */
    disabled?: boolean;
}

let {
    sockethubState,
    connecting,
    onConnect,
    disabled = false,
}: Props = $props();

let _isDisabled = $derived(
    disabled ||
        !$sockethubState.credentialsSet ||
        $sockethubState.connected ||
        connecting,
);

let _buttonText = $derived(
    $sockethubState.connected
        ? "Connected"
        : connecting
          ? "Connecting"
          : "Connect",
);
</script>

<div class="w-full flex justify-end">
    <SockethubButton
        disabled={isDisabled}
        buttonAction={onConnect}
    >
        {#if connecting}
            <div class="flex items-center space-x-2">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Connecting...</span>
            </div>
        {:else if $sockethubState.connected}
            <div class="flex items-center space-x-2">
                <svg class="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Connected</span>
            </div>
        {:else}
            <div class="flex items-center space-x-2">
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                <span>Connect</span>
            </div>
        {/if}
    </SockethubButton>
</div>