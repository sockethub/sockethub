<script lang="ts">
  import SockethubButton from "$components/SockethubButton.svelte";
  import { send } from "$lib/sockethub";
  import type { ActorData } from "$lib/sockethub";
  import type { AnyActivityStream } from "$lib/sockethub";
  import type { StateStore } from "$lib/types";

  export let room: string;
  export let actor: ActorData;
  export let context: string;
  export let state: StateStore;

  let joining = false;

  async function joinRoom(): Promise<void> {
    joining = true;
    return await send({
      context: context,
      type: "join",
      actor: actor.id,
      target: {
        id: room,
        name: room,
        type: "room",
      },
    } as AnyActivityStream)
      .catch(() => {
        $state.joined = false;
      })
      .then(() => {
        // $actor.roomId = room;
        $state.joined = true;
      });
  }
</script>

<div>
  <div class="w-full p-2">
    <label for="room" class="inline-block text-gray-900 font-bold w-32">Room</label>
    <input id="room" bind:value={room} class="border-4" />
  </div>
  <div class="w-full text-right">
    <SockethubButton
      disabled={!$state.connected || $state.joined || joining}
      buttonAction={joinRoom}
      >{joining ? "Joining" : $state.joined ? "Joined" : "Join"}</SockethubButton
    >
  </div>
</div>
