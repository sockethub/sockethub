<!-- @migration-task Error while migrating Svelte code: can't migrate `let connecting = false;` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import Credentials from "$components/Credentials.svelte";
import Intro from "$components/Intro.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import IncomingMessage from "$components/chat/IncomingMessages.svelte";
import Room from "$components/chat/Room.svelte";
import SendMessage from "$components/chat/SendMessage.svelte";
import Logger from "$components/logs/Logger.svelte";
import { send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import type { CredentialName } from "$lib/sockethub";
import { writable } from "svelte/store";

const actorId = writable("user@jabber.org");
let connecting = $state(false);

// let actorId = $derived(`${$actorIdStore}/SockethubExample`);

const room = "kosmos-random@kosmos.chat";

const sockethubState = writable({
    actorSet: false,
    credentialsSet: false,
    connected: false,
    joined: false,
});

let actor = $derived({
    id: $actorId,
    type: "person",
    name: $actorId,
});

let credentials = $derived({
    type: "credentials" as CredentialName,
    userAddress: $actorId,
    password: "***",
    resource: "SockethubExample",
});

async function connectXmpp(): Promise<void> {
    connecting = true;
    return await send({
        context: "xmpp",
        type: "connect",
        actor: $actorId,
    } as AnyActivityStream)
        .then(() => {
            $sockethubState.connected = true;
        })
        .catch(() => {
            $sockethubState.connected = false;
        });
}
</script>

<Intro title="XMPP Platform Example">
    <title>XMPP Example</title>
    <p>Example for the XMPP platform</p>
</Intro>

<ActivityActor {actor} {sockethubState} />
<div class="w-full pb-4">
    <label for="actor-id-input" class="pr-3">Actor ID</label>
    <input
        id="actor-id-input"
        class=" bg-white border border-solid border-gray-300 rounded"
        type="text"
        bind:value={$actorId}
    />
</div>

<Credentials context="xmpp" {credentials} {actor} {sockethubState} />

<div>
    <div class="w-full text-right">
        <SockethubButton
            disabled={!$sockethubState.credentialsSet || $sockethubState.connected || connecting}
            buttonAction={connectXmpp}
            >{$sockethubState.connected
                ? "Connected"
                : connecting
                  ? "Connecting"
                  : "Connect"}</SockethubButton
        >
    </div>
</div>

<Room {actor} {sockethubState} {room} context="xmpp" />

<IncomingMessage />

<SendMessage context="xmpp" {actor} {sockethubState} {room} />

<Logger />
