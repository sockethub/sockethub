<div class="w-16 md:w-32 lg:w-48 grow w-full">
  <label for="credentials" class="form-label inline-block text-gray-900 font-bold mb-2">Credentials</label>
  <pre><textarea
    bind:value={credentialsString}
    class="form-control block w-full px-3 py-1.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
    id="credentials" rows="5"></textarea></pre>
</div>
<div class="w-16 md:w-32 lg:w-48 w-full">
  <div class="flex gap-4 mt-8">
    <div id="sendCredentials">
      <SockethubButton buttonAction={sendCredentials}>Set Credentials</SockethubButton>
    </div>
  </div>
</div>

<script lang="ts">
  import SockethubButton from "./SockethubButton.svelte";
  import { sc } from "$lib/sockethub";
  export let credentials;

  $: credentialsString = JSON.stringify(credentials);

  function sendCredentials() {
    const creds = JSON.parse(credentialsString);
    credentials.set(creds);
    console.log('sending credentials:  ', creds);
    sc.socket.emit('credentials', Object.create(creds), (resp) => {
      console.log('credentials set: ', resp);
    });
  }
</script>
