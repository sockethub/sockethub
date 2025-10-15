<script lang="ts">
import SockethubButton from "./SockethubButton.svelte";
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

let { sockethubState, connecting, onConnect, disabled = false }: Props = $props();

let isDisabled = $derived(
    disabled || 
    !$sockethubState.credentialsSet || 
    $sockethubState.connected || 
    connecting
);

let buttonText = $derived(
    $sockethubState.connected 
        ? "Connected" 
        : connecting 
            ? "Connecting" 
            : "Connect"
);
</script>

<div class="w-full text-right">
    <SockethubButton
        disabled={isDisabled}
        buttonAction={onConnect}
    >
        {buttonText}
    </SockethubButton>
</div>