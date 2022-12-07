<script context="module">
  import {writable, get} from "svelte/store";
  const messages = writable([]);

  export function displayMessage(m) {
    if ((m.type === "send") && (m.object?.type === "message")) {
      messages.set([...get(messages), [m.actor.name, m.object.content]]);
    }
  }
</script>

<div>
  <label for="incomingMessagesContainer" class="text-gray-900 font-bold">Incoming Messages</label>
  <div id="incomingMessagesContainer" class="w-full">
    <ui id="incomingMessages">
      {#each $messages as l}
        <li>{l[0]}: {l[1]}</li>
      {/each}
    </ui>
    <div id="incomingMessagesAnchor"></div>
  </div>
</div>
