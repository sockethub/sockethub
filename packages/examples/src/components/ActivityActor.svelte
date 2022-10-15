<div class="w-16 md:w-32 lg:w-48 grow w-full">
  <label for="activityStreamActor" class="form-label inline-block text-gray-900 font-bold mb-2">Activity Stream Actor</label>
  <pre><textarea
    bind:value={actorString}
    class="form-control block w-full px-3 py-1.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
    id="activityStreamActor" rows="5"></textarea></pre>
</div>
<div class="w-16 md:w-32 lg:w-48 w-full">
  <div class="flex gap-4">
    <div id="sendASObject">
      <label for="sendASObject" class="form-label inline-block text-gray-900 font-bold mb-2">Activity Object Create</label>
      <SockethubButton buttonAction={sendActivityObjectCreate}>Send</SockethubButton>
    </div>
  </div>
</div>

<script lang="ts">
  import SockethubButton from "./SockethubButton.svelte";
  import { sc } from "../lib/sockethub";
  export let actorString = "{}";

  function sendActivityObjectCreate() {
    const actor = JSON.parse(actorString);
    console.log('creating activity object:  ', actor);
    sc.ActivityStreams.Object.create(actor);
  }
</script>
