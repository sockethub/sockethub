<Intro heading="IRC Platform Example">
  <title>IRC Example</title>
  <p>Example for the IRC platform</p>
</Intro>

<Module>
  <ActivityActor actor={actor} />
</Module>

<Module>
  <Credentials credentials={credentials} />
</Module>

<Module>
  <div class="w-16 md:w-32 lg:w-48 grow w-full">
    <label for="server" class="form-label inline-block text-gray-900 font-bold mb-2">IRC Server</label>
    <input id="server" bind:value={server} class="border-4 grow w-full">
  </div>
  <div class="w-16 md:w-24 lg:w-32 grow w-full">
    <label for="port" class="form-label inline-block text-gray-900 font-bold mb-2">Port</label>
    <input id="port" bind:value={port} class="border-4 grow w-full">
  </div>
  <div class="w-16 md:w-32 lg:w-48 grow w-full">
    <label for="room" class="form-label inline-block text-gray-900 font-bold mb-2">Room</label>
    <input id="room" bind:value={room} class="border-4 grow w-full">
  </div>
  <div class="w-16 md:w-32 lg:w-48 w-full">
    <div class="flex gap-4 mt-6">
      <div>
        <SockethubButton buttonAction={connectIrc}>Connect</SockethubButton>
      </div>
    </div>
  </div>
</Module>

<Module>
  <Logger />
</Module>

<script>
  import Intro from "$components/Intro.svelte";
  import Module from "$components/Module.svelte";
  import ActivityActor from "$components/ActivityActor.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger, { addObject, ObjectType } from "$components/logs/Logger.svelte";
  import { sc } from "$lib/sockethub";
  import Credentials from "$components/Credentials.svelte";
  import { getActorStore } from "$stores/ActorStore";
  import { getCredentialsStore } from "$stores/CredentialsStore";

  const nick = (Math.random() + 1).toString(36).substring(7);
  const actorId = `https://sockethub.org/examples/irc/sh-${nick}`;
  const actor = getActorStore({
    id: actorId,
    type: "person",
    name: `sh-${nick}`
  });

  let server = "irc.libera.chat";
  let port = "6697";
  let room = "#sh-random";

  const credentials = getCredentialsStore({
    type: 'credentials',
    nick: nick,
    server: server,
    port: parseInt(port, 10),
    secure: true
  });

  function send(obj) {
    sc.socket.emit('message', addObject(ObjectType.send, obj), (resp) => {
      console.log('RESP:, ', resp);
      addObject(ObjectType.resp, resp, resp.id);
    });
  }

  function connectIrc() {
    send({
      context: "irc",
      type: "connect",
      actor: actorId
    });
  }
</script>
