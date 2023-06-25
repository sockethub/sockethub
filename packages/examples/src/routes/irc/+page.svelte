<script lang="ts">
  import Intro from "$components/Intro.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger from "$components/logs/Logger.svelte";
  import type { AnyActivityStream } from "$lib/sockethub";
  import { send } from "$lib/sockethub";
  import ActivityActor from "$components/ActivityActor.svelte";
  import Credentials from "$components/Credentials.svelte";
  import IncomingMessage from "$components/chat/IncomingMessages.svelte";
  import Room from "$components/chat/Room.svelte";
  import SendMessage from "$components/chat/SendMessage.svelte";
  import { writable } from "svelte/store";

  const actorIdStore = writable(`sh-${(Math.random() + 1).toString(36).substring(7)}`);

  let server = "irc.libera.chat";
  let port = 6697;
  let room = "#sh-random";
  let connecting = false;

  const state = writable({
    actorSet: false,
    credentialsSet: false,
    connected: false,
    joined: false,
  });

  $: actor = {
    id: $actorIdStore,
    type: "person",
    name: $actorIdStore,
  };

  $: credentials = {
    type: "credentials",
    nick: $actorIdStore,
    server: server,
    port: port,
    secure: true,
  };

  async function connectIrc() {
    connecting = true;
    await send({
      context: "irc",
      type: "connect",
      actor: $actorIdStore,
    } as AnyActivityStream)
      .catch(() => {
        $state.connected = false;
      })
      .then(() => {
        $state.connected = true;
      });
    connecting = false;
  }
</script>

<Intro heading="IRC Platform Example">
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

<ActivityActor {actor} {state} />
<Credentials context="irc" {credentials} {actor} {state} />

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
      disabled={!$state.credentialsSet || $state.connected || connecting}
      buttonAction={connectIrc}
      >{$state.connected ? "Connected" : connecting ? "Connecting" : "Connect"}</SockethubButton
    >
  </div>
</div>

<Room {actor} {state} {room} context="irc" />

<IncomingMessage />

<SendMessage context="irc" {actor} {state} {room} />

<Logger />
