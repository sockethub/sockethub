<script lang="ts" module>
import type { AnyActivityStream } from "$lib/sockethub";
import { writable } from "svelte/store";

type LogEntries = Record<
    string,
    [
        AnyActivityStream | Record<string, never>,
        AnyActivityStream | Record<string, never>,
    ]
>;
const Logs = writable({} as LogEntries);
let counter = 0;

type ObjectType = "SEND" | "RESP";

export function addObject(
    type: ObjectType,
    obj: AnyActivityStream,
    parentId?: string,
) {
    let index = "unset";
    if (parentId) {
        index = `${parentId}-${++counter}`;
        obj.id = index;
    } else if (obj.id) {
        index = obj.id;
    }

    Logs.update((currentLogs: LogEntries) => {
        if (!currentLogs[index]) {
            if (type === "SEND") {
                currentLogs[index] = [obj, {}];
            } else {
                currentLogs[index] = [{}, obj];
            }
        } else {
            const pos = type === "SEND" ? 0 : 1;
            currentLogs[index][pos] = obj;
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

    let logs: LogEntries = $state();
    let logModalState = $state(false);
    let jsonSend = $state("");
    let jsonResp = $state("");

    Logs.subscribe((data: LogEntries) => {
        logs = data;
    });

    function showLog(uid: string) {
        return () => {
            let indexSend = uid;
            let indexResp = uid;
            if (uid.includes("-")) {
                indexSend = uid.split("-")[0];
            }
            console.log(`indexSend:${indexSend} indexResp:${indexResp}`);
            console.log("logs: ", logs);
            logModalState = true;
            jsonSend = JSON.stringify(logs[indexSend][0], null, 2);
            jsonResp = JSON.stringify(logs[indexResp][1] || {}, null, 2);
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
            }) as [id, tuple]}
                {#if Array.isArray(tuple[tuple.length - 1])}
                    {#each Object.entries(tuple[tuple.length - 1]) as [s, r]}
                        {#if r}
                            <LogEntry
                                buttonAction={showLog(`${id}-${s}`)}
                                response={typeof logs[id][1] !== "undefined"}
                                id={`${id}-${s}`}
                                entry={r}
                            />
                        {/if}
                    {/each}
                {:else if Object.prototype.hasOwnProperty.call(tuple[1], "context")}
                    <LogEntry buttonAction={showLog(id)} {id} response={true} entry={tuple[1]} />
                {:else}
                    <LogEntry buttonAction={showLog(id)} {id} response{false} entry={tuple[0]} />
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
    <div id="modalContent" class="max-w-[95%] rounded-md m-auto p-2">
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
                onclick={() => (logModalState = false)}
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
