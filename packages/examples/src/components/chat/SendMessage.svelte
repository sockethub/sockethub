<!-- @migration-task Error while migrating Svelte code: can't migrate `let message = "";` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import Icon from "$components/Icon.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { actorAsObject, contextFor, send } from "$lib/sockethub";
import type { ActorData } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

interface Props {
    actor: ActorData;
    context: string;
    sockethubState: SockethubStateStore;
    room: string;
    // For IRC, the connection server used to qualify the room id as
    // `#channel@server` (XMPP rooms are already full JIDs).
    server?: string;
}

let { actor, context, sockethubState, room, server }: Props = $props();

let message = $state("");
let sending = $state(false);

async function sendMessage() {
    if (!message.trim()) return;
    // IRC room targets must be server-qualified (`#channel@server`); never fall
    // back to a bare channel, which the platform rejects.
    if (context === "irc" && !server) {
        console.error("IRC sends require a server (#channel@server)");
        return;
    }

    sending = true;
    const messageToSend = message.trim();
    console.log("send message: ", messageToSend);

    const targetId = context === "irc" ? `${room}@${server}` : room;
    try {
        await send({
            "@context": await contextFor(context),
            type: "send",
            actor: actorAsObject(actor),
            object: {
                type: "message",
                content: messageToSend,
            },
            target: {
                id: targetId,
                name: room,
                type: "room",
            },
        });
        message = "";
    } catch (error) {
        console.error("Failed to send message:", error);
    } finally {
        sending = false;
    }
}
</script>

<form
    class="flex gap-2"
    onsubmit={(e) => {
        e.preventDefault();
        if (!sending && $sockethubState.connected) sendMessage();
    }}
>
    <label for="sendMessage" class="sr-only">Your message</label>
    <input
        id="sendMessage"
        bind:value={message}
        class="input flex-1"
        placeholder={$sockethubState.joined ? `Message ${room}` : "Join a room to start chatting"}
        autocomplete="off"
    />
    <SockethubButton
        disabled={!$sockethubState.connected || sending || !message.trim()}
        buttonAction={sendMessage}
    >
        {#if sending}
            <Icon name="loader" class="size-4 animate-spin" />
            <span class="sr-only sm:not-sr-only">Sending…</span>
        {:else}
            <Icon name="send" class="size-4" />
            <span class="sr-only sm:not-sr-only">Send</span>
        {/if}
    </SockethubButton>
</form>
