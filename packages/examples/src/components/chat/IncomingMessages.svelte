<script context="module" lang="ts">
  import { writable, get } from "svelte/store";
  import type { AnyActivityStream } from "$lib/sockethub";

  const messages = writable([] as Record<string, any>[]);

  export function displayMessage(m: AnyActivityStream) {
    if (m.type === "send" && m.object?.type === "message") {
      messages.set([
        ...get(messages),
        [typeof m.actor === "string" ? m.actor : m.actor?.name || "", m.object.content],
      ]);
    }
  }
</script>

<div>
  <label for="incomingMessagesContainer" class="text-gray-900 font-bold">Incoming Messages</label>

  <div id="incomingMessagesContainer" class="incoming-messages-container w-full">
    <ui class="incoming-messages">
      {#each $messages as l}
        <li>{l[0]}: {l[1]}</li>
      {/each}
    </ui>
    <div class="incoming-messages-anchor" />
  </div>
</div>
