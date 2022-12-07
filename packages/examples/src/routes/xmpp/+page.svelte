<Intro heading="XMPP Platform Example">
  <title>XMPP Example</title>
  <p>Example for the XMPP platform</p>
</Intro>

<ActivityActor actor={actor} />
<Credentials credentials={credentials} actor={actor} />

<div>
  <div class="w-full p-2">
    <label for="server" class="inline-block text-gray-900 font-bold w-32">XMPP Server</label>
    <input id="server" bind:value={server} class="border-4">
  </div>
  <div class="w-full p-2">
    <label for="port" class="inline-block text-gray-900 font-bold w-32">Port</label>
    <input id="port" bind:value={port} class="border-4">
  </div>
  <div class="w-full text-right">
    <SockethubButton
      disabled={!$actor.state.credentialsSet || $actor.state.connected || connecting}
      buttonAction={connectXmpp}
    >{$actor.state.connected ? "Connected" : connecting ? "Connecting" : "Connect"}</SockethubButton>
  </div>
</div>

<Room actor={actor} room={room} context="xmpp" />

<IncomingMessage />

<SendMessage actor={actor} />

<Logger />

<script lang="ts">
  import Intro from "$components/Intro.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger, { addObject, ObjectType } from "$components/logs/Logger.svelte";
  import { send } from "$lib/sockethub";
  import type { AnyActivityStream } from "$lib/sockethub";
  import { getActorStore } from "$stores/ActorStore";
  import ActivityActor from "$components/ActivityActor.svelte";
  import Credentials from "$components/Credentials.svelte";
  import IncomingMessage, { displayMessage } from "$components/chat/IncomingMessages.svelte";
  import Room from "$components/chat/Room.svelte";
  import SendMessage from "$components/chat/SendMessage.svelte";

  const actorId = `sh-${(Math.random() + 1).toString(36).substring(7)}`;

  let server = "irc.libera.chat";
  let port = "6697";
  let room = "#sh-random";
  let connecting = false;

  const actor = getActorStore({
    state: {
      actorSet: false,
      credentialsSet: false,
      connected: false,
      joined: false
    },
    object: {
      id: actorId,
      type: "person",
      name: actorId
    },
    roomId: room
  });

  const credentials = {
    type: 'credentials',
    nick: actorId,
    server: server,
    port: parseInt(port, 10),
    secure: true
  };

  async function connectXmpp() {
    connecting = true;
    await send({
      context: "xmpp",
      type: "connect",
      actor: actorId
    } as AnyActivityStream).catch(() => {
      $actor.state.connected = false;
    }).then(() => {
      $actor.state.connected = true;
    });
    connecting = false;
  }
</script>
