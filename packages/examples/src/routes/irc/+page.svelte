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
import Step from "$components/Step.svelte";
import type { AnyActivityStream, CredentialName } from "$lib/sockethub";
import { contextFor, send } from "$lib/sockethub";
import { writable } from "svelte/store";

const actorIdStore = writable(
    `sh-${(Math.random() + 1).toString(36).substring(7)}`,
);

let server = $state("irc.libera.chat");
let port = $state(6697);
let room = $state("#sh-random");
let connecting = $state(false);

const sockethubState = writable({
    actorSet: false,
    credentialsSet: false,
    connected: false,
    joined: false,
});

let actor = $derived({
    id: `${$actorIdStore}@${server}`,
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
    try {
        await send({
            "@context": await contextFor("irc"),
            type: "connect",
            actor: {
                id: actor.id,
                type: actor.type,
                name: actor.name,
            },
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
    platform="irc"
    title="IRC Platform Example"
    description="Connect to a real IRC network, join a channel, and chat. Sockethub keeps the IRC connection open for you while this page is open."
>
    <Step n={1} title="Choose a server and nickname" description="Try irc.libera.chat or irc.oftc.net. Your actor is nickname@server, so changing either field means confirming it again." done={$sockethubState.actorSet}>
        <div class="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:gap-4">
            <FormField label="IRC Server" id="server" bind:value={server} placeholder="irc.libera.chat" />
            <FormField label="Port" id="port" type="number" bind:value={port} placeholder="6697" />
        </div>
        <ActorIdField label="Nickname" bind:value={$actorIdStore} />
        <ActivityActor {actor} {sockethubState} />
    </Step>

    <Step n={2} title="Send credentials" description="Tells Sockethub how to log in. Sent once per session, separate from your activities." done={$sockethubState.credentialsSet} blockedHint={$sockethubState.actorSet ? undefined : "Confirm the actor first."}>
        <Credentials context="irc" {credentials} {actor} {sockethubState} />
    </Step>

    <Step n={3} title="Connect" description="Sends a connect activity. Sockethub opens the IRC connection." done={$sockethubState.connected} blockedHint={$sockethubState.credentialsSet || $sockethubState.connected ? undefined : "Send credentials first."}>
        <PlatformConnection {sockethubState} {connecting} onConnect={connectIrc} />
    </Step>

    <Step
        n={4}
        title="Join a channel and chat"
        locked={!$sockethubState.connected}
        lockedHint="Connect first to join a channel."
        done={$sockethubState.joined}
    >
        <Room {actor} {sockethubState} bind:room context="irc" {server} />
        <IncomingMessage />
        <SendMessage context="irc" {actor} {sockethubState} {room} {server} />
    </Step>
</BaseExample>
