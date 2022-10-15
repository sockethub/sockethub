<div>
  <label for="messages" class="form-label inline-block text-gray-900 font-bold mb-2">Response from Sockethub</label>
  <div id="messages">
    <ul>
      {#each Object.entries(logs).sort((a, b) => {
        let i = a[0], j;
        let k = b[0], l;
        if (a[0].includes('-')) {
          [i, j] = a[0].split('-');
        }
        if (b[0].includes('-')) {
          [k, l] = b[0].split('-');
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
              <LogEntry buttonAction={showLog(`${id}-${i}`)} id={`${id}-${i}`} entry={r} ({r.id})/>
            {/if}
          {/each}
        {:else}
          <LogEntry buttonAction={showLog(id)} id={id} entry={v[v.length - 1]} />
        {/if}
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
  let counter = 0;

  export enum ObjectType {
    send = "SEND",
    resp = "RESP"
  }

  export function addObject(type: ObjectType, obj, id) {
    if (!id) {
      obj.id = "" + ++counter;
    } else {
      obj.id = id;
    }
    Logs.update(currentLogs => {
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
      if (uid.includes('-')) {
        indexSend = uid.split('-')[0];
      }
      console.log(`indexSend:${indexSend} indexResp:${indexResp}`);
      console.log('logs: ', logs);
      selectedLog = uid;
      logModalState = true;
      jsonSend = JSON.stringify(logs[indexSend][0], undefined, 2);
      jsonResp = JSON.stringify(logs[indexResp][logs[indexResp].length - 1], undefined, 2);
    }
  }
</script>
