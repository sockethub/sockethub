<script lang="ts">
import type { SockethubStateStore } from "$lib/types";
import Icon from "./Icon.svelte";
import SockethubButton from "./SockethubButton.svelte";

/**
 * Connect button for platforms that hold a live connection (IRC, XMPP).
 * Shows "Connect", "Connecting…", then "Connected".
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

let isDisabled = $derived(
    disabled ||
        !$sockethubState.credentialsSet ||
        $sockethubState.connected ||
        connecting,
);
</script>

<div class="flex justify-end">
    <SockethubButton
        disabled={isDisabled}
        buttonAction={async () => {
            await onConnect();
        }}
    >
        {#if connecting}
            <Icon name="loader" class="size-4 animate-spin" />
            <span>Connecting…</span>
        {:else if $sockethubState.connected}
            <Icon name="check" class="size-4" />
            <span>Connected</span>
        {:else}
            <Icon name="plug" class="size-4" />
            <span>Connect</span>
        {/if}
    </SockethubButton>
</div>
