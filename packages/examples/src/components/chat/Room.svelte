<!-- @migration-task Error while migrating Svelte code: can't migrate `let joining = false;` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import SockethubButton from "$components/SockethubButton.svelte";
import { send } from "$lib/sockethub";
import type { ActorData } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";
import type { Writable } from "svelte/store";

interface Props {
    room: string;
    actor: ActorData;
    context: string;
    sockethubState: SockethubStateStore;
}

let { room, actor, context, sockethubState }: Props = $props();

let joining = $state(false);

async function joinRoom(): Promise<void> {
    joining = true;
    return await send({
        context: context,
        type: "join",
        actor: actor.id,
        target: {
            id: room,
            name: room,
            type: "room",
        },
    } as AnyActivityStream)
        .catch(() => {
            $sockethubState.joined = false;
        })
        .then(() => {
            // $actor.roomId = room;
            $sockethubState.joined = true;
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
