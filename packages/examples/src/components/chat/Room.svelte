<script lang="ts">
  import SockethubButton from "$components/SockethubButton.svelte";
  import { send } from "$lib/sockethub";
  import type { AnyActivityStream } from "$lib/sockethub";
  export let room: string;
  export let actor;
  export let context: string;
  let joining = false;

  async function joinRoom() {
    joining = true;
    await send({
      context: context,
      type: "join",
      actor: $actor.object.id,
      target: {
        id: room,
        name: room,
        type: "room"
      }
    } as AnyActivityStream).catch(() => {
      $actor.state.joined = false;
    }).then(() => {
      $actor.roomId = room;
      $actor.state.joined = true;
    });
    joining = false;
  }
</script>

<div>
  <div class="w-full p-2">
    <label for="room" class="inline-block text-gray-900 font-bold w-32">Room</label>
    <input id="room" bind:value={room} class="border-4">
  </div>
  <div class="w-full text-right">
    <SockethubButton disabled={!$actor.state.connected || $actor.state.joined || joining} buttonAction={joinRoom}>{joining ? "Joining" : $actor.state.joined ? "Joined" : "Join"}</SockethubButton>
  </div>
</div>
