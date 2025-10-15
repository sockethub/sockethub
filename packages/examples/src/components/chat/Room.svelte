<!-- @migration-task Error while migrating Svelte code: can't migrate `let joining = false;` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import SockethubButton from "$components/SockethubButton.svelte";
import { send } from "$lib/sockethub";
import type { ActorData } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

interface Props {
    room: string;
    actor: ActorData;
    context: string;
    sockethubState: SockethubStateStore;
}

let { room = $bindable(), actor, context, sockethubState }: Props = $props();

let joining = $state(false);

async function joinRoom(): Promise<void> {
    joining = true;
    return await send({
        // Platform context - routes to the appropriate chat platform (irc, xmpp)
        context: context,
        // Activity type - "join" means join a chat room/channel
        type: "join",
        // Actor - who is joining (the connected user)
        actor: actor.id,
        // Target - what room/channel to join
        target: {
            id: room,
            name: room,
            type: "room",
        },
    } as AnyActivityStream)
        .catch(() => {
            $sockethubState.joined = false;
            joining = false;
        })
        .then(() => {
            // $actor.roomId = room;
            $sockethubState.joined = true;
            joining = false;
        });
}
</script>

<div>
    <div class="w-full p-2">
        <label for="room" class="inline-block text-gray-900 font-bold w-32">Room</label>
        <input id="room" bind:value={room} class="border-4" />
    </div>
    <div class="w-full text-right">
        <SockethubButton
            disabled={!$sockethubState.connected || $sockethubState.joined || joining}
            buttonAction={joinRoom}
            >{joining ? "Joining" : $sockethubState.joined ? "Joined" : "Join"}</SockethubButton
        >
    </div>
</div>
