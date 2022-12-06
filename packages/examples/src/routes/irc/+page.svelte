<Intro heading="IRC Platform Example">
  <title>IRC Example</title>
  <p>Example for the IRC platform</p>
</Intro>

<ActivityActor actor={actor} />
<Credentials credentials={credentials} actor={actor} />

<div>
  <div class="w-full p-2">
    <label for="server" class="inline-block text-gray-900 font-bold w-32">IRC Server</label>
    <input id="server" bind:value={server} class="border-4 ">
  </div>
  <div class="w-full p-2">
    <label for="port" class="inline-block text-gray-900 font-bold w-32">Port</label>
    <input id="port" bind:value={port} class="border-4 ">
  </div>
  <div class="w-full text-right">
    <SockethubButton disabled={!$actor.state.credentialed || connected || (connected === false && sending)} buttonAction={connectIrc}>{connected ? "Connected" : "Connect"}</SockethubButton>
  </div>
</div>

<Room actor={actor} room={room} context="irc" />

<IncomingMessage />

<div>
  <div class="w-full">
    <label for="sendMessage" class="form-label inline-block text-gray-900 font-bold mb-2">Message</label>
    <input id="sendMessage" bind:value={message} class="border-4 w-full">
  </div>
  <div class="text-right">
    <SockethubButton disabled={!connected || sending} buttonAction={sendMessage}>Send</SockethubButton>
  </div>
</div>

<Logger />

<script lang="ts">
  import Intro from "$components/Intro.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger, { addObject, ObjectType } from "$components/logs/Logger.svelte";
  import { sc } from "$lib/sockethub";
  import { getActorStore } from "$stores/ActorStore";
  import ActivityActor from "$components/ActivityActor.svelte";
  import Credentials from "$components/Credentials.svelte";
  import IncomingMessage, { displayMessage } from "$components/chat/IncomingMessages.svelte";
  import Room from "$components/chat/Room.svelte";

  const actorId = `sh-${(Math.random() + 1).toString(36).substring(7)}`;

  let server = "irc.libera.chat";
  let port = "6697";
  let room = "#sh-random";
  let connected = false;
  let sending = false;
  let joined = false;
  let message = "";

  const actor = getActorStore({
    state: {
      actored: false,
      credentialed: false,
      connected: false,
      joined: false
    },
    object: {
      id: actorId,
      type: "person",
      name: actorId
    }
  });

  const credentials = {
      type: 'credentials',
      nick: actorId,
      server: server,
      port: parseInt(port, 10),
      secure: true
  };

  function send(obj) {
    sending = true;
    console.log('sending: ', obj);
    sc.socket.emit('message', addObject(ObjectType.send, obj), (resp) => {
      console.log('RESP: ', resp);
      addObject(ObjectType.resp, resp, resp.id);
      displayMessage(resp);
      if (resp.type === "connect") {
        connected = !resp.error;
      }
      sending = false;
    });
  }

  function connectIrc() {
    send({
      context: "irc",
      type: "connect",
      actor: actorId
    });
  }

  function sendMessage() {
    console.log('send message: ', message);
    send({
      context: "irc",
      type: "send",
      actor: actorId,
      object: {
        type: "message",
        content: message
      },
      target: {
        id: room,
        name: room,
        type: "room"
      }
    })
  }
</script>
