<div class="w-full">
  <label class="form-label inline-block text-gray-900 font-bold mb-2">{title}</label>
  <pre><textarea
    bind:value={objString}
    class="form-control block w-full px-3 py-1.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
    rows="5"></textarea></pre>
</div>
{#if password !== "unset"}
<div class="w-full p-2">
  <label for="server" class="inline-block text-gray-900 font-bold w-32">Password</label>
  <input id="server" bind:value={password} type="password" class="border-4">
</div>
{/if}
<div class="w-full text-right">
  <SockethubButton disabled={disabled} buttonAction={handleSubmit}>{buttonText}</SockethubButton>
</div>

<script lang="ts">
  import SockethubButton from "./SockethubButton.svelte";
  import {createEventDispatcher} from "svelte";

  export let buttonText = "Send";
  export let disabled;
  export let obj;
  export let title;

  let password = "unset";

  const dispatcher = createEventDispatcher();

  if (obj.password) {
    password = obj.password;
    delete obj.password;
  }

  $: objString = JSON.stringify(obj, null, 3)

  function handleSubmit() {
    const objSend = JSON.parse(objString);
    if (password !== "unset") {
      objSend.password = password;
    }

    dispatcher("submit", {
      jsonString: JSON.stringify(objSend)
    });
  }
</script>
