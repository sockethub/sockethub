<script lang="ts">
  import Intro from "$components/Intro.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger from "$components/logs/Logger.svelte";
  import { send } from "$lib/sockethub";
  import type { AnyActivityStream } from "$lib/sockethub";
  import ActivityActor from "$components/ActivityActor.svelte";
  import Credentials from "$components/Credentials.svelte";
  import IncomingMessage from "$components/chat/IncomingMessages.svelte";
  import SendMessage from "$components/chat/SendMessage.svelte";
  import Room from "$components/chat/Room.svelte";
  import { writable } from "svelte/store";


  const actorIdStore = writable("user@jabber.org");
  let connecting = false;

  $: actorId = `${$actorIdStore}/SockethubExample`;

  let room = "kosmos-random@kosmos.chat";

  const state = writable({
      actorSet: false,
      credentialsSet: false,
      connected: false,
      joined: false,
  });

  $: actor = {
      id: actorId,
      type: "person",
      name: actorId,
  };

  $: credentials = {
    type: "credentials",
    userAddress: $actorIdStore,
    password: "123456",
    resource: "SockethubExample",
  };

  async function connectXmpp() {
    connecting = true;
    await send({
      context: "xmpp",
      type: "connect",
      actor: actorId,
    } as AnyActivityStream)
      .then(() => {
        $state.connected = true;
      })
      .catch(() => {
        $state.connected = false;
      });
    connecting = false;
  }
</script>

<Intro heading="XMPP Platform Example">
  <title>XMPP Example</title>
  <p>Example for the XMPP platform</p>
</Intro>

<div class="pb-4">
  <label for="actor-id-input" class="pr-3">Actor ID</label>
  <input id="actor-id-input" class=" bg-white border border-solid border-gray-300 rounded " type="text" bind:value={$actorIdStore} />
</div>

<ActivityActor {actor} {state} />
<Credentials context="xmpp" {credentials} {actor} {state} />

<div>
  <div class="w-full text-right">
    <SockethubButton
      disabled={!$state.credentialsSet || $state.connected || connecting}
      buttonAction={connectXmpp}
      >{$state.connected
        ? "Connected"
        : connecting
        ? "Connecting"
        : "Connect"}</SockethubButton
    >
  </div>
</div>

<Room {actor} {state} {room} context="xmpp" />

<IncomingMessage />

<SendMessage context="xmpp" {actor} {state} {room} />

<Logger />
