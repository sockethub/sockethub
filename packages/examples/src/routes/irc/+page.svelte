<!-- @migration-task Error while migrating Svelte code: can't migrate `let server = "chat.freenode.net";` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import { writable } from "svelte/store";
import type { AnyActivityStream, CredentialName } from "$lib/sockethub";
import { send } from "$lib/sockethub";

const _actorIdStore = writable(
    `sh-${(Math.random() + 1).toString(36).substring(7)}`,
);

let server = $state("chat.freenode.net");
let port = $state(6697);
let _room = "#sh-random";
let _connecting = $state(false);

const _sockethubState = writable({
    actorSet: false,
    credentialsSet: false,
    connected: false,
    joined: false,
});

let _actor = $derived({
    id: $actorIdStore,
    type: "person",
    name: $actorIdStore,
});

let _credentials = $derived({
    type: "credentials" as CredentialName,
    nick: $actorIdStore,
    server: server,
    port: port,
    secure: true,
});

function resetState() {
    $sockethubState.actorSet = false;
    $sockethubState.credentialsSet = false;
    $sockethubState.connected = false;
    $sockethubState.joined = false;
    _connecting = false;
}

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
async function _connectIrc(): Promise<void> {
    _connecting = true;
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
            resetState();
        })
        .then(
            () => {
                $sockethubState.connected = true;
                _connecting = false;
            },
            (err) => {
                console.error(err);
                resetState();
            },
        );
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
        <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm">
            <h4 class="text-lg font-bold text-green-900 mb-4 flex items-center">
                <span class="mr-3 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Choose Your IRC Nickname
            </h4>
            <div class="space-y-4">
                <ActorIdField bind:value={$actorIdStore} />
                <ActivityActor {actor} {sockethubState} />
            </div>
        </div>

        <!-- Step 2: Server Configuration -->
        <div class="bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-xl p-6 shadow-sm">
            <h4 class="text-lg font-bold text-blue-900 mb-4 flex items-center">
                <span class="mr-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Configure Server Connection
            </h4>
            <div class="space-y-4">
                <div class="grid md:grid-cols-2 gap-4">
                    <FormField label="IRC Server" id="server" bind:value={server} placeholder="irc.libera.chat" />
                    <FormField label="Port" id="port" type="number" bind:value={port} placeholder="6697" />
                </div>
                <div class="bg-blue-100 border border-blue-200 rounded-lg p-3">
                    <p class="text-blue-800 text-sm">
                        💡 <strong>Popular IRC networks:</strong> irc.libera.chat, irc.oftc.net, irc.rizon.net
                    </p>
                </div>
                <Credentials context="irc" {credentials} {actor} {sockethubState} />
            </div>
        </div>

        <!-- Step 3: Connect -->
        <div class="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-6 shadow-sm">
            <h4 class="text-lg font-bold text-purple-900 mb-4 flex items-center">
                <span class="mr-3 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Connect to Server
            </h4>
            <PlatformConnection
                {sockethubState}
                {connecting}
                onConnect={connectIrc}
            />
        </div>

        <!-- Step 4 & 5: Chat Interface (only shown when connected) -->
        {#if $sockethubState.connected}
            <div class="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-6 shadow-sm">
                <h4 class="text-lg font-bold text-emerald-900 mb-4 flex items-center">
                    <span class="mr-3 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                    Join Channel and Chat
                </h4>
                <div class="space-y-6">
                    <Room {actor} {sockethubState} {room} context="irc" />
                    <IncomingMessage />
                    <SendMessage context="irc" {actor} {sockethubState} {room} />
                </div>
            </div>
        {:else}
            <div class="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-6 text-center shadow-sm">
                <div class="flex items-center justify-center mb-3">
                    <span class="w-8 h-8 bg-gray-400 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                </div>
                <p class="text-gray-600 font-medium">Connect to the IRC server to access chat features</p>
                <p class="text-gray-500 text-sm mt-1">Complete steps 1-3 above to unlock this section</p>
            </div>
        {/if}
    </div>
</BaseExample>
