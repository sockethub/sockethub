<script lang="ts">
  import Intro from "$components/Intro.svelte";
  import SockethubButton from "$components/SockethubButton.svelte";
  import Logger from "$components/logs/Logger.svelte";
  import { send } from "$lib/sockethub";
  import type { AnyActivityStream } from "$lib/sockethub";
  import { getActorStore } from "$stores/ActorStore";
  import ActivityActor from "$components/ActivityActor.svelte";
  import Credentials from "$components/Credentials.svelte";
  import IncomingMessage from "$components/chat/IncomingMessages.svelte";
  import SendMessage from "$components/chat/SendMessage.svelte";
  import Room from "$components/chat/Room.svelte";

  let userAddress = "user@jabber.org";
  let connecting = false;

  const actorId = `${userAddress}/SockethubExample`;

  let room = "kosmos-random@kosmos.chat";

  const actor = getActorStore("xmpp", {
    state: {
      actorSet: false,
      credentialsSet: false,
      connected: false,
      joined: false,
    },
    object: {
      id: actorId,
      type: "person",
      name: actorId,
    },
    roomId: room,
  });

  const credentials = {
    type: "credentials",
    userAddress: userAddress,
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
        $actor.state.connected = true;
      })
      .catch(() => {
        $actor.state.connected = false;
      });
    connecting = false;
  }
</script>

<Intro heading="XMPP Platform Example">
  <title>XMPP Example</title>
  <p>Example for the XMPP platform</p>
</Intro>

<ActivityActor {actor} />
<Credentials context="xmpp" {credentials} {actor} />

<div>
  <div class="w-full text-right">
    <SockethubButton
      disabled={!$actor.state.credentialsSet || $actor.state.connected || connecting}
      buttonAction={connectXmpp}
      >{$actor.state.connected
        ? "Connected"
        : connecting
        ? "Connecting"
        : "Connect"}</SockethubButton
    >
  </div>
</div>

<Room {actor} {room} context="xmpp" />

<IncomingMessage />

<SendMessage context="xmpp" {actor} />

<Logger />
