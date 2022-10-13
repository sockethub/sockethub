<div>
  <label for="messages" class="form-label inline-block text-gray-900 font-bold mb-2">Response from Sockethub</label>
  <div id="messages">
    <ul>
      {#each Object.entries(logs).reverse() as [id, log]}
        <span class="hidden">{log = log[log.length - 1] }</span>
        <li>
          <button on:click="{showLog(id)}"
                  data-modal-toggle="defaultModal"
                  class="hover:bg-blue-400 bg-blue-300 text-black py-0 px-2 rounded mr-3 mb-1">view log</button>
          <span>#{id} {log.actor.name || log.actor.id}</span> [<span>{log.type}</span>]: <span>{log.object.content}</span>
          {#if log.error}
            <span class="ml-5 text-red-500">{log.error}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
</div>

<div class="{logModalState ? '' : 'hidden'} bg-slate-800 bg-opacity-50 flex justify-center items-center absolute top-0 right-0 bottom-0 left-0">
  <div style="" class="bg-offwhite px-2 py-2 rounded-md text-left">
    <div class="flex flex-row">
      <div class="text-xs mb-4 text-slate-500 font-mono py-1 basis-1/2">
        <h2>Sent</h2>
        <Highlight language={json} code={jsonSend} />
      </div>
      <div class="text-xs mb-4 text-slate-500 font-mono py-1 basis-1/2">
        <h2>Response</h2>
        <Highlight language={json} code={jsonResp} />
      </div>
    </div>
    <div class="flex flex-col text-center">
      <button on:click="{() => logModalState = false }" class="bg-indigo-500 px-7 py-2 ml-2 rounded-md text-sm text-white font-semibold">Ok</button>
    </div>
  </div>
</div>

<script lang="ts" context="module">
  import { writable } from "svelte/store";

  const Logs = writable({});

  export enum ObjectType {
    send = "SEND",
    resp = "RESP"
  }

  export function addObject(type: ObjectType, obj) {
    console.log(`logger ${type}: `, obj);
    Logs.update(currentLogs => {
      if (!currentLogs[obj.id]) {
        currentLogs[obj.id] = [obj];
      } else {
        currentLogs[obj.id] = [...currentLogs[obj.id], obj]
      }
      return currentLogs;
    });
  }
</script>

<script lang="ts">
  import Highlight from "svelte-highlight";
  import json from "svelte-highlight/languages/json";

  let logs;
  let logModalState = false;
  let jsonSend = "";
  let jsonResp = "";
  let selectedLog = 0;

  Logs.subscribe((data) => {
    logs = data;
  });

  function showLog(uid) {
    return () => {
      selectedLog = uid;
      logModalState = true;
      jsonSend = JSON.stringify(logs[uid][0], undefined, 2);
      jsonResp = JSON.stringify(logs[uid][1], undefined, 2);
    }
  }
</script>
