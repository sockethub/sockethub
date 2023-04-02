<script lang="ts" context="module">
  import { writable } from "svelte/store";

  const Logs = writable({});
  let counter = 0;

  export enum ObjectType {
    send = "SEND",
    resp = "RESP",
  }

  export function addObject(type: ObjectType, obj, id) {
    if (!id) {
      obj.id = "" + ++counter;
    } else {
      obj.id = id;
    }
    Logs.update((currentLogs) => {
      if (!currentLogs[obj.id]) {
        currentLogs[obj.id] = [obj];
      } else {
        currentLogs[obj.id].push(obj);
        // = [...currentLogs[obj.id], obj]
      }
      return currentLogs;
    });
    return obj;
  }
</script>

<script lang="ts">
  import LogEntry from "./LogEntry.svelte";
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
      let indexSend = uid;
      let indexResp = uid;
      if (uid.includes("-")) {
        indexSend = uid.split("-")[0];
      }
      console.log(`indexSend:${indexSend} indexResp:${indexResp}`);
      console.log("logs: ", logs);
      selectedLog = uid;
      logModalState = true;
      jsonSend = JSON.stringify(logs[indexSend][0], null, 2);
      jsonResp = JSON.stringify(logs[indexResp][logs[indexResp].length - 1], null, 2);
    };
  }
</script>

<div class="mb-28">
  <label for="messages" class="form-label inline-block text-gray-900 font-bold mb-2"
    >Response from Sockethub</label
  >
  <div id="messages">
    <ul>
      {#each Object.entries(logs).sort((a, b) => {
        let i = a[0],
          j;
        let k = b[0],
          l;
        if (a[0].includes("-")) {
          [i, j] = a[0].split("-");
        }
        if (b[0].includes("-")) {
          [k, l] = b[0].split("-");
        }
        if (j && l) {
          return parseInt(j) >= parseInt(l) ? -1 : 1;
        } else {
          return parseInt(i) >= parseInt(k) ? -1 : 1;
        }
      }) as [id, v]}
        {#if Array.isArray(v[v.length - 1])}
          {#each Object.entries(v[v.length - 1]) as [i, r]}
            {#if r}
              <LogEntry buttonAction={showLog(`${id}-${i}`)} id={`${id}-${i}`} entry={r} ({r.id}) />
            {/if}
          {/each}
        {:else}
          <LogEntry buttonAction={showLog(id)} {id} entry={v[v.length - 1]} />
        {/if}
      {/each}
    </ul>
  </div>
</div>

<div
  class="{logModalState
    ? ''
    : 'hidden'} bg-slate-800 bg-opacity-50 fixed top-0 left-0 m-0 w-full h-full overflow-scroll"
>
  <div id="modalContent" class="max-w-[95%] bg-offwhite rounded-md m-auto p-2">
    <div>
      <div class="text-xs text-slate-500 font-mono">
        <h2 class="ml-2">Sent</h2>
        <Highlight language={json} code={jsonSend} />
      </div>
      <div class="text-xs text-slate-500 font-mono">
        <h2 class="ml-2">Response</h2>
        <Highlight language={json} code={jsonResp} />
      </div>
    </div>
    <div class="w-full text-center">
      <button
        on:click={() => (logModalState = false)}
        class="bg-indigo-500 px-7 py-2 w-[95%] rounded-md text-sm text-white font-semibold"
        >Ok</button
      >
    </div>
  </div>
</div>

<svelte:head>
  {#if logModalState}
    <style>
      body {
        overflow: hidden;
      }
    </style>
  {/if}
</svelte:head>
