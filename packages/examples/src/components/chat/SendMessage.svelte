<script lang="ts">
import SockethubButton from "$components/SockethubButton.svelte";
import { send } from "$lib/sockethub";
import type { ActorData } from "$lib/sockethub";
import type { StateStore } from "$lib/types";

export let actor: ActorData;
export let context: string;
export let state: StateStore;
export let room: string;

let message = "";
let sending = false;

async function sendMessage() {
    sending = true;
    console.log("send message: ", message);
    await send({
        context: context,
        type: "send",
        actor: actor.id,
        object: {
            type: "message",
            content: message,
        },
        target: {
            id: room,
            name: room,
            type: "room",
        },
    });
    sending = false;
}
</script>

<div>
    <div class="w-full">
        <label for="sendMessage" class="form-label inline-block text-gray-900 font-bold mb-2"
            >Message</label
        >
        <input id="sendMessage" bind:value={message} class="border-4 w-full" />
    </div>
    <div class="text-right">
        <SockethubButton disabled={!$state.connected || sending} buttonAction={sendMessage}
            >{sending ? "Sending" : "Send"}</SockethubButton
        >
    </div>
</div>
