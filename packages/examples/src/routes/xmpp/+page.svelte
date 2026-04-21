<!-- @migration-task Error while migrating Svelte code: can't migrate `let connecting = false;` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import ActorIdField from "$components/ActorIdField.svelte";
import BaseExample from "$components/BaseExample.svelte";
import Credentials from "$components/Credentials.svelte";
import PlatformConnection from "$components/PlatformConnection.svelte";
import IncomingMessage from "$components/chat/IncomingMessages.svelte";
import Room from "$components/chat/Room.svelte";
import SendMessage from "$components/chat/SendMessage.svelte";
import { contextFor, send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import type { CredentialName } from "$lib/sockethub";
import { writable } from "svelte/store";

const actorIdStore = writable("user@jabber.org");
let connecting = $state(false);
let passwordValue = $state("123456");

let actorId = $derived(`${$actorIdStore}/SockethubExample`);

let room = $state("kosmos-random@kosmos.chat");

const sockethubState = writable({
    actorSet: false,
    credentialsSet: false,
    connected: false,
    joined: false,
});

let actor = $derived({
    id: actorId,
    type: "person",
    name: actorId,
});

let credentials = $derived({
    type: "credentials" as CredentialName,
    userAddress: $actorIdStore,
    resource: "SockethubExample",
    password: passwordValue,
});

async function connectXmpp(): Promise<void> {
    connecting = true;
    try {
        await send({
            "@context": contextFor("xmpp"),
            type: "connect",
            actor: actorId,
        } as AnyActivityStream);
        $sockethubState.connected = true;
    } catch (err) {
        console.error(err);
        // Keep actor/credentials state so the user can immediately retry connect.
        $sockethubState.connected = false;
        $sockethubState.joined = false;
    } finally {
        connecting = false;
    }
}
</script>

<BaseExample
    title="XMPP Platform Example"
    description="Connect to XMPP servers (Jabber), join multi-user chats, and exchange messages using Sockethub's XMPP platform."
>
    <div class="bg-indigo-50 border-l-4 border-indigo-400 p-4 rounded-r-lg mb-6">
        <h3 class="text-lg font-semibold text-indigo-800 mb-2">📨 XMPP Connection Process</h3>
        <p class="text-indigo-700 text-sm mb-3">
            XMPP (Extensible Messaging and Presence Protocol) is a real-time communication protocol used by services like Jabber.
        </p>
        <div class="text-indigo-700 text-sm space-y-1">
            <div><strong>1. 🎭 Set Actor:</strong> Your XMPP address (e.g., user@jabber.org)</div>
            <div><strong>2. 🔐 Set Credentials:</strong> Your XMPP login secret, sent through the password field</div>
            <div><strong>3. 🔌 Connect:</strong> Establish connection to XMPP server</div>
            <div><strong>4. 🏠 Join Room:</strong> Enter a multi-user chat room</div>
            <div><strong>5. 💬 Send Messages:</strong> Chat with other users in real-time</div>
        </div>
    </div>

    <div class="space-y-6">
        <!-- Step 1: Setup Identity -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-800 mb-3">Step 1: Set Your XMPP Address</h4>
            <ActorIdField bind:value={$actorIdStore} />
            <p class="text-gray-600 text-sm mt-2">
                💡 Format: username@server.com (e.g., user@jabber.org, alice@conversations.im)
            </p>
            <ActivityActor {actor} {sockethubState} />
        </div>

        <!-- Step 2: Credentials -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-800 mb-3">Step 2: Set Your Credentials</h4>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="xmpp-password-input">
                Password
            </label>
            <input
                id="xmpp-password-input"
                type="password"
                bind:value={passwordValue}
                disabled={$sockethubState.credentialsSet}
                class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3"
                placeholder="your XMPP password or compatible bearer token"
            />
            <p class="text-gray-600 text-xs mb-3">
                💡 If your deployment accepts a bearer-style token in the SASL PLAIN password
                slot, enter that token here. Sockethub's XMPP platform still submits it as
                <code>password</code>.
            </p>
            <Credentials context="xmpp" {credentials} {actor} {sockethubState} />
            <p class="text-gray-600 text-sm mt-2">
                🔐 Sockethub's XMPP platform accepts a single <code>password</code> field.
            </p>
        </div>

        <!-- Step 3: Connect -->
        <div class="bg-white border border-gray-200 rounded-lg p-4">
            <h4 class="font-semibold text-gray-800 mb-3">Step 3: Connect to XMPP Server</h4>
            <PlatformConnection
                {sockethubState}
                {connecting}
                onConnect={connectXmpp}
            />
        </div>

        <!-- Step 4 & 5: Chat Interface (only shown when connected) -->
        {#if $sockethubState.connected}
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <h4 class="font-semibold text-gray-800 mb-3">Step 4 & 5: Join Room and Chat</h4>
                <div class="space-y-4">
                    <Room {actor} {sockethubState} bind:room context="xmpp" />
                    <IncomingMessage />
                    <SendMessage context="xmpp" {actor} {sockethubState} {room} />
                </div>
            </div>
        {:else}
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p class="text-gray-500">Connect to the XMPP server to access chat features</p>
            </div>
        {/if}
    </div>
</BaseExample>
