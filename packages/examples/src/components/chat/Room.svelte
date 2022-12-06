<script lang="ts">
  import SockethubButton from "$components/SockethubButton.svelte";
  import { sc } from "$lib/sockethub";
  import { addObject, ObjectType } from "$components/logs/Logger.svelte";
  export let room: string;
  export let actor;
  export let context: string;
  let sending = false;

  function joinRoom() {
    sending = true;
    const obj = {
      context: "context",
      type: "join",
      actor: $actor.object.id,
      target: {
        id: room,
        name: room,
        type: "room"
      }
    }
    sc.socket.emit('message', addObject(ObjectType.send, obj), (resp) => {
      addObject(ObjectType.resp, resp, resp.id);
      if (!resp.error) {
        $actor.state.joined = true;
      }
      sending = false;
    });
  }
</script>

<div>
  <div class="w-full p-2">
    <label for="room" class="inline-block text-gray-900 font-bold w-32">Room</label>
    <input id="room" bind:value={room} class="border-4">
  </div>
  <div class="w-full text-right">
    <SockethubButton disabled={!$actor.state.connected || $actor.state.joined || sending} buttonAction={joinRoom}>Join</SockethubButton>
  </div>
</div>
