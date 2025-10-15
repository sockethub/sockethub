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
    description="Connect to IRC servers, join channels, and send messages using Sockethub's IRC platform."
>
    <div class="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-lg mb-6">
        <h3 class="text-lg font-semibold text-orange-800 mb-2">💬 IRC Connection Process</h3>
        <p class="text-orange-700 text-sm mb-3">
            IRC (Internet Relay Chat) requires several steps to get connected and chatting.
        </p>
        <div class="text-orange-700 text-sm space-y-1">
            <div><strong>1. 🎭 Set Actor:</strong> Choose your IRC nickname</div>
            <div><strong>2. 🔐 Set Credentials:</strong> Provide server connection details</div>
            <div><strong>3. 🔌 Connect:</strong> Establish connection to IRC server</div>
            <div><strong>4. 🏠 Join Room:</strong> Enter a channel to start chatting</div>
            <div><strong>5. 💬 Send Messages:</strong> Chat with other users</div>
        </div>
    </div>
    <div class="space-y-6">
        <!-- Step 1: Setup Identity -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-800 mb-3">Step 1: Choose Your IRC Nickname</h4>
            <ActorIdField bind:value={$actorIdStore} />
            <ActivityActor {actor} {sockethubState} />
        </div>

        <!-- Step 2: Server Configuration -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-800 mb-3">Step 2: Configure Server Connection</h4>
            <div class="space-y-4">
                <FormField label="IRC Server" id="server" bind:value={server} placeholder="irc.libera.chat" />
                <FormField label="Port" id="port" type="number" bind:value={port} placeholder="6697" />
                <p class="text-gray-600 text-sm">
                    💡 Popular IRC networks: irc.libera.chat, irc.oftc.net, irc.rizon.net
                </p>
                <Credentials context="irc" {credentials} {actor} {sockethubState} />
            </div>
        </div>

        <!-- Step 3: Connect -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-800 mb-3">Step 3: Connect to Server</h4>
            <PlatformConnection 
                {sockethubState} 
                {connecting} 
                onConnect={connectIrc} 
            />
        </div>

        <!-- Step 4 & 5: Chat Interface (only shown when connected) -->
        {#if $sockethubState.connected}
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <h4 class="font-semibold text-gray-800 mb-3">Step 4 & 5: Join Channel and Chat</h4>
                <div class="space-y-4">
                    <Room {actor} {sockethubState} {room} context="irc" />
                    <IncomingMessage />
                    <SendMessage context="irc" {actor} {sockethubState} {room} />
                </div>
            </div>
        {:else}
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p class="text-gray-500">Connect to the IRC server to access chat features</p>
            </div>
        {/if}
    </div>
</BaseExample>
