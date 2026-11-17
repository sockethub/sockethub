<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import ActorIdField from "$components/ActorIdField.svelte";
import BaseExample from "$components/BaseExample.svelte";
import Credentials from "$components/Credentials.svelte";
import PlatformConnection from "$components/PlatformConnection.svelte";
import IncomingMessage from "$components/chat/IncomingMessages.svelte";
import Room from "$components/chat/Room.svelte";
import SendMessage from "$components/chat/SendMessage.svelte";
import Step from "$components/Step.svelte";
import { contextFor, send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import type { CredentialName } from "$lib/sockethub";
import { writable } from "svelte/store";

const actorIdStore = writable("user@jabber.org");
let connecting = $state(false);

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
    password: "",
});

async function connectXmpp(): Promise<void> {
    connecting = true;
    try {
        await send({
            "@context": await contextFor("xmpp"),
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
    platform="xmpp"
    title="XMPP Platform Example"
    description="Sign in to an XMPP (Jabber) account, join a group chat room, and exchange messages in real time."
>
    <Step n={1} title="Enter your XMPP address" description="Your actor is your address plus a resource name that identifies this client." done={$sockethubState.actorSet}>
        <ActorIdField label="XMPP address" hint="For example alice@jabber.org or bob@conversations.im." bind:value={$actorIdStore} />
        <ActivityActor {actor} {sockethubState} />
    </Step>

    <Step n={2} title="Send credentials" description="Your password goes in its own field. Sent once per session, separate from your activities." done={$sockethubState.credentialsSet} blockedHint={$sockethubState.actorSet ? undefined : "Confirm the actor first."}>
        <p class="hint">
            If your server accepts a bearer token in the SASL PLAIN password slot, enter the token as the password.
        </p>
        <Credentials context="xmpp" {credentials} {actor} {sockethubState} />
    </Step>

    <Step n={3} title="Connect" description="Sends a connect activity. Sockethub signs in to your XMPP server." done={$sockethubState.connected} blockedHint={$sockethubState.credentialsSet || $sockethubState.connected ? undefined : "Send credentials first."}>
        <PlatformConnection {sockethubState} {connecting} onConnect={connectXmpp} />
    </Step>

    <Step
        n={4}
        title="Join a room and chat"
        locked={!$sockethubState.connected}
        lockedHint="Connect first to join a room."
        done={$sockethubState.joined}
    >
        <Room {actor} {sockethubState} bind:room context="xmpp" />
        <IncomingMessage />
        <SendMessage context="xmpp" {actor} {sockethubState} {room} />
    </Step>
</BaseExample>
