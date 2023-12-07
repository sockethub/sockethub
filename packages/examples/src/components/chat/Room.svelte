<script lang="ts">
  import SockethubButton from "$components/SockethubButton.svelte";
  import { send } from "$lib/sockethub";
  import type { AnyActivityStream } from "$lib/sockethub";
  import type { ActorData } from "$stores/ActorStore";
  import type { BaseStore } from "$stores/BaseStore";

  export let room: string;
  export let actor: BaseStore<ActorData>;
  export let context: string;
  let joining = false;

  async function joinRoom(): Promise<void> {
    joining = true;
    return await send({
      context: context,
      type: "join",
      actor: $actor.object.id,
      target: {
        id: room,
        name: room,
        type: "room",
      },
    } as AnyActivityStream)
      .catch(() => {
        if ($actor.state) {
          $actor.state.joined = false;
        }
        joining = false;
      })
      .then(() => {
        $actor.roomId = room;
        if ($actor.state) {
          $actor.state.joined = true;
        }
        joining = false;
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
      disabled={$actor.state ? !$actor.state.connected || $actor.state.joined || joining : joining}
      buttonAction={joinRoom}
      >{joining
        ? "Joining"
        : $actor.state
        ? $actor.state.joined
          ? "Joined"
          : "Join"
        : "Join"}</SockethubButton
    >
  </div>
</div>
