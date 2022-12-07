<script lang="ts">
  import SockethubButton from "$components/SockethubButton.svelte";
  import { send } from "$lib/sockethub";
  import type { AnyActivityStream } from "$lib/sockethub";

  export let actor;
  let message = "";
  let sending = false;

  async function sendMessage() {
    sending = true;
    console.log('send message: ', message);
    await send({
      context: "irc",
      type: "send",
      actor: $actor.object.id,
      object: {
        type: "message",
        content: message
      },
      target: {
        id: $actor.roomId,
        name: $actor.roomId,
        type: "room"
      }
    } as AnyActivityStream);
    sending = false;
  }
</script>

<div>
  <div class="w-full">
    <label for="sendMessage" class="form-label inline-block text-gray-900 font-bold mb-2">Message</label>
    <input id="sendMessage" bind:value={message} class="border-4 w-full">
  </div>
  <div class="text-right">
    <SockethubButton disabled={!$actor.state.connected || sending} buttonAction={sendMessage}>{sending ? "Sending" : "Send"}</SockethubButton>
  </div>
</div>
