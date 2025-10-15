<!-- @migration-task Error while migrating Svelte code: can't migrate `let server = "chat.freenode.net";` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import ActorIdField from "$components/ActorIdField.svelte";
import BaseExample from "$components/BaseExample.svelte";
import Credentials from "$components/Credentials.svelte";
import FormField from "$components/FormField.svelte";
import PlatformConnection from "$components/PlatformConnection.svelte";
import IncomingMessage from "$components/chat/IncomingMessages.svelte";
import Room from "$components/chat/Room.svelte";
import SendMessage from "$components/chat/SendMessage.svelte";
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

/**
 * Sends a connect request to Sockethub's IRC platform.
 * 
 * This example app:
 * 1. Sets the connecting state to show "Connecting" button text
 * 2. Sends a connect ActivityStreams message to Sockethub's IRC platform
 * 3. Updates connection state based on Sockethub's response
 * 4. Resets the connecting state
 * 
 * Sockethub's IRC platform will handle the actual IRC protocol connection
 * using the credentials (server, port, nick, secure) that were previously sent.
 */
async function connectIrc(): Promise<void> {
    connecting = true;
    await send({
        // Platform context - routes to Sockethub's IRC platform
        context: "irc",
        // Activity type - "connect" establishes IRC connection
        type: "connect",
        // Actor - the IRC nick/identity making the connection
        actor: $actorIdStore,
        // Note: credentials (server, port, etc.) are sent separately via the Credentials component
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

<BaseExample 
    title="IRC Platform Example"
    description="Example for the IRC platform"
>
    <ActorIdField bind:value={$actorIdStore} />

    <ActivityActor {actor} {sockethubState} />
    <Credentials context="irc" {credentials} {actor} {sockethubState} />

    <div>
        <FormField label="IRC Server" id="server" bind:value={server} placeholder="irc.example.com" />
        <FormField label="Port" id="port" type="number" bind:value={port} placeholder="6667" />
        <PlatformConnection 
            {sockethubState} 
            {connecting} 
            onConnect={connectIrc} 
        />
    </div>

    <Room {actor} {sockethubState} {room} context="irc" />

    <IncomingMessage />

    <SendMessage context="irc" {actor} {sockethubState} {room} />
</BaseExample>
