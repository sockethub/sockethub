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
import { send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import type { CredentialName } from "$lib/sockethub";
import { writable } from "svelte/store";

const actorIdStore = writable("user@jabber.org");
let connecting = $state(false);

let actorId = $derived(`${$actorIdStore}/SockethubExample`);

const room = "kosmos-random@kosmos.chat";

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
    password: "123456",
    resource: "SockethubExample",
});

async function connectXmpp(): Promise<void> {
    connecting = true;
    return await send({
        context: "xmpp",
        type: "connect",
        actor: actorId,
    } as AnyActivityStream)
        .then(() => {
            $sockethubState.connected = true;
        })
        .catch(() => {
            $sockethubState.connected = false;
        });
}
</script>

<BaseExample 
    title="XMPP Platform Example"
    description="Example for the XMPP platform"
>

    <ActivityActor {actor} {sockethubState} />
    <ActorIdField bind:value={$actorIdStore} />

    <Credentials context="xmpp" {credentials} {actor} {sockethubState} />

    <PlatformConnection 
        {sockethubState} 
        {connecting} 
        onConnect={connectXmpp} 
    />

    <Room {actor} {sockethubState} {room} context="xmpp" />

    <IncomingMessage />

    <SendMessage context="xmpp" {actor} {sockethubState} {room} />
</BaseExample>
