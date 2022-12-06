<div class="w-full">
  <label class="form-label inline-block text-gray-900 font-bold mb-2">{title}</label>
  <pre><textarea
    bind:value={storeString}
    class="form-control block w-full px-3 py-1.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
    rows="5"></textarea></pre>
</div>
<div class="w-full text-right">
  <SockethubButton disabled={disabled} buttonAction={handleSubmit}>{buttonText}</SockethubButton>
</div>

<script lang="ts">
  import SockethubButton from "./SockethubButton.svelte";
  import {createEventDispatcher} from "svelte";
  import { get } from "svelte/store";
  import type { BaseStore } from "$stores/BaseStore";
  import type { ActorData } from "$stores/ActorStore";
  import type { CredentialData } from "$stores/CredentialsStore";

  export let buttonText = "Send";
  export let disabled;
  export let store: BaseStore<ActorData|CredentialData>;
  export let title;

  const dispatcher = createEventDispatcher();

  $: storeString = JSON.stringify(get(store).object, null, 3).trim();

  function handleSubmit() {
    dispatcher("submit", {
      jsonString: storeString
    });
  }
</script>
