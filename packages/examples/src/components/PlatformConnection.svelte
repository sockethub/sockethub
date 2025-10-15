<script lang="ts">
import SockethubButton from "./SockethubButton.svelte";
import type { SockethubStateStore } from "$lib/types";

interface Props {
    sockethubState: SockethubStateStore;
    connecting: boolean;
    onConnect: () => void | Promise<void>;
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