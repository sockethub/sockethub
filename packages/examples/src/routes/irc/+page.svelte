<!-- @migration-task Error while migrating Svelte code: can't migrate `let server = "chat.freenode.net";` to `$state` because there's a variable named state.
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
import type { AnyActivityStream, CredentialName } from "$lib/sockethub";
import { send } from "$lib/sockethub";
import { writable } from "svelte/store";

const actorIdStore = writable(
    `sh-${(Math.random() + 1).toString(36).substring(7)}`,
);

let server = $state("chat.freenode.net");
let port = $state(6697);
let room = "#sh-random";
let connecting = $state(false);

const sockethubState = writable({
    actorSet: false,
    credentialsSet: false,
    connected: false,
    joined: false,
});

let actor = $derived({
    id: $actorIdStore,
    type: "person",
    name: $actorIdStore,
});

let credentials = $derived({
    type: "credentials" as CredentialName,
    nick: $actorIdStore,
    server: server,
    port: port,
    secure: true,
});

async function connectIrc(): Promise<void> {
    connecting = true;
    await send({
        context: "irc",
        type: "connect",
        actor: $actorIdStore,
    } as AnyActivityStream)
        .catch(() => {
            $sockethubState.connected = false;
            connecting = false;
        })
        .then(() => {
            $sockethubState.connected = true;
            connecting = false;
        });
}
</script>

<Intro title="IRC Platform Example">
    <title>IRC Example</title>
    <p>Example for the IRC platform</p>
</Intro>

<div class="pb-4">
    <label for="actor-id-input" class="pr-3">Actor ID</label>
    <input
        id="actor-id-input"
        class=" bg-white border border-solid border-gray-300 rounded"
        type="text"
        bind:value={$actorIdStore}
    />
</div>

<ActivityActor {actor} {sockethubState} />
<Credentials context="irc" {credentials} {actor} {sockethubState} />

<div>
    <div class="w-full p-2">
        <label for="server" class="inline-block text-gray-900 font-bold w-32">IRC Server</label>
        <input id="server" bind:value={server} class="border-4" />
    </div>
    <div class="w-full p-2">
        <label for="port" class="inline-block text-gray-900 font-bold w-32">Port</label>
        <input id="port" bind:value={port} class="border-4" />
    </div>
    <div class="w-full text-right">
        <SockethubButton
            disabled={!$sockethubState.credentialsSet || $sockethubState.connected || connecting}
            buttonAction={connectIrc}
            >{$sockethubState.connected
                ? "Connected"
                : connecting
                  ? "Connecting"
                  : "Connect"}</SockethubButton
        >
    </div>
</div>

<Room {actor} {sockethubState} {room} context="irc" />

<IncomingMessage />

<SendMessage context="irc" {actor} {sockethubState} {room} />

<Logger />
