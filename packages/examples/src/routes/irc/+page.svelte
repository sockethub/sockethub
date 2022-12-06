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
    <SockethubButton disabled={!$credentials.isSet || connected || (connected === false && sending)} buttonAction={connectIrc}>{connected ? "Connected" : "Connect"}</SockethubButton>
  </div>
</div>


<div>
  <div class="w-full p-2">
    <label for="room" class="inline-block text-gray-900 font-bold w-32">Room</label>
    <input id="room" bind:value={room} class="border-4">
  </div>
  <div class="w-full text-right">
    <SockethubButton disabled={!connected || joined || sending} buttonAction={joinRoom}>Join</SockethubButton>
  </div>
</div>

<div>
  <label for="incomingMessagesContainer" class="text-gray-900 font-bold">Incoming Messages</label>
  <div id="incomingMessagesContainer" class="w-full">
    <ui id="incomingMessages"></ui>
  </div>
</div>

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
  import { getCredentialsStore } from "$stores/CredentialsStore";
  import ActivityActor from "$components/ActivityActor.svelte";
  import Credentials from "$components/Credentials.svelte";

  const actorId = `sh-${(Math.random() + 1).toString(36).substring(7)}`;

  let server = "irc.libera.chat";
  let port = "6697";
  let room = "#sh-random";
  let connected = false;
  let sending = false;
  let joined = false;
  let message = "";

  const actor = getActorStore({
    isSet: false,
    object: {
      id: actorId,
      type: "person",
      name: actorId
    }
  });

  const credentials = getCredentialsStore({
    isSet: false,
    object: {
      type: 'credentials',
      nick: actorId,
      server: server,
      port: parseInt(port, 10),
      secure: true
    }
  });

  function send(obj) {
    sending = true;
    console.log('sending: ', obj);
    sc.socket.emit('message', addObject(ObjectType.send, obj), (resp) => {
      console.log('RESP:, ', resp);
      addObject(ObjectType.resp, resp, resp.id);
      if (obj.type === "connect") {
        connected = !resp.error;
      } else if (obj.type === "join") {
        joined = true;
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

  function joinRoom() {
    send({
      context: "irc",
      type: "join",
      actor: actorId,
      target: {
        id: room,
        name: room,
        type: "room"
      }
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
