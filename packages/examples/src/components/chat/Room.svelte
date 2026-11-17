<!-- @migration-task Error while migrating Svelte code: can't migrate `let joining = false;` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import Icon from "$components/Icon.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { actorAsObject, contextFor, send } from "$lib/sockethub";
import type { ActorData } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

interface Props {
    room: string;
    actor: ActorData;
    context: string;
    sockethubState: SockethubStateStore;
    // For IRC, the connection server used to qualify the room id as
    // `#channel@server` (XMPP rooms are already full JIDs).
    server?: string;
}

let {
    room = $bindable(),
    actor,
    context,
    sockethubState,
    server,
}: Props = $props();

let joining = $state(false);
let lastJoinedRoom = $state("");

// Reset joined state when room changes so the user can join the new room
$effect(() => {
    if (room !== lastJoinedRoom) {
        $sockethubState.joined = false;
    }
});

async function joinRoom(): Promise<void> {
    // IRC room targets must be server-qualified (`#channel@server`); never fall
    // back to a bare channel, which the platform rejects.
    if (context === "irc" && !server) {
        console.error("IRC room joins require a server (#channel@server)");
        return;
    }
    joining = true;
    const targetId = context === "irc" ? `${room}@${server}` : room;
    return await send({
        "@context": await contextFor(context),
        type: "join",
        actor: actorAsObject(actor),
        target: {
            id: targetId,
            name: room,
            type: "room",
        },
    } as AnyActivityStream)
        .then(() => {
            lastJoinedRoom = room;
            $sockethubState.joined = true;
        })
        .catch((err) => {
            $sockethubState.joined = false;
            console.error("joinRoom failed", {
                action: "join",
                platform: context,
                room,
                server,
                err,
            });
            throw err;
        })
        .finally(() => {
            joining = false;
        });
}
</script>

<div class="space-y-1.5">
    <label for="room" class="label">{context === "irc" ? "Channel" : "Room address"}</label>
    <div class="flex flex-col gap-2 sm:flex-row">
        <input
            id="room"
            bind:value={room}
            class="input sm:flex-1"
            placeholder={context === "irc" ? "#sockethub" : "room@conference.example.org"}
        />
        <SockethubButton
            disabled={!$sockethubState.connected || $sockethubState.joined || joining}
            buttonAction={joinRoom}
        >
            {#if joining}
                <Icon name="loader" class="size-4 animate-spin" />
                <span>Joining…</span>
            {:else if $sockethubState.joined}
                <Icon name="check" class="size-4" />
                <span>Joined</span>
            {:else}
                <Icon name="door" class="size-4" />
                <span>Join Room</span>
            {/if}
        </SockethubButton>
    </div>
    <p class="hint">
        {context === "irc" ? "Include the leading #. Sockethub adds the server for you." : "The full address of a multi-user chat room."}
    </p>
</div>
