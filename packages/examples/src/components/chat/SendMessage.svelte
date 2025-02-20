<!-- @migration-task Error while migrating Svelte code: can't migrate `let message = "";` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import SockethubButton from "$components/SockethubButton.svelte";
import { send } from "$lib/sockethub";
import type { ActorData } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

    interface Props {
        actor: ActorData;
        context: string;
        sockethubState: SockethubStateStore;
        room: string;
    }

    let {
        actor,
        context,
        sockethubState,
        room
    }: Props = $props();

let message = $state("");
let sending = $state(false);

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
        <SockethubButton disabled={!$sockethubState.connected || sending} buttonAction={sendMessage}
            >{sending ? "Sending" : "Send"}</SockethubButton
        >
    </div>
</div>
