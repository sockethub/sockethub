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
const LogMeta = writable({} as Record<string, { timestamp: number; sortKey: number }>);
let counter = 0;

type ObjectType = "SEND" | "RESP";

export function addObject(
    type: ObjectType,
    obj: AnyActivityStream,
    isBatch = false,
): AnyActivityStream {
    let index: string;

    if (obj.id) {
        index = obj.id;
    } else {
        index = `${++counter}`;
    }

    obj.id = index;

    if (isBatch) {
        index = `${index}-${++counter}`;
    }

    const now = Date.now();
    LogMeta.update((meta) => {
        if (!meta[index]) {
            meta[index] = { timestamp: now, sortKey: counter };
        }
        return meta;
    });

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

export type SchemaLogType = "schemas" | "ready" | "init_error";

export interface SchemaLogEntry {
    _logType: SchemaLogType;
    _logId: string;
    _sortKey: number;
    _timestamp: number;
    payload: unknown;
}

const SchemaLogs = writable([] as SchemaLogEntry[]);

export function addSchemaEvent(type: SchemaLogType, payload: unknown) {
    const entry: SchemaLogEntry = {
        _logType: type,
        _logId: `${type}-${++counter}`,
        _sortKey: counter,
        _timestamp: Date.now(),
        payload,
    };
    SchemaLogs.update((logs) => [entry, ...logs]);
}

export { SchemaLogs };
</script>

<script lang="ts">
    import LogEntry from "./LogEntry.svelte";
    import SchemaLogEntryComponent from "./SchemaLogEntry.svelte";
    import Highlight from "svelte-highlight";
    import json from "svelte-highlight/languages/json";

    type UnifiedEntry =
        | { kind: "activity"; id: string; sortKey: number; timestamp: number; tuple: [AnyActivityStream | Record<string, never>, AnyActivityStream | Record<string, never>] }
        | { kind: "schema"; sortKey: number; entry: SchemaLogEntry };

    let logs: LogEntries = $state();
    let meta: Record<string, { timestamp: number; sortKey: number }> = $state({});
    let schemaLogs: SchemaLogEntry[] = $state([]);
    let logModalState = $state(false);
    let jsonSend = $state("");
    let jsonResp = $state("");
    let modalTitle = $state("ActivityStreams Data Exchange");

    Logs.subscribe((data: LogEntries) => {
        logs = data;
    });
    LogMeta.subscribe((data: Record<string, { timestamp: number; sortKey: number }>) => {
        meta = data;
    });
    SchemaLogs.subscribe((data: SchemaLogEntry[]) => {
        schemaLogs = data;
    });

    const unified: UnifiedEntry[] = $derived.by(() => {
        const items: UnifiedEntry[] = [];
        for (const [id, tuple] of Object.entries(logs ?? {})) {
            const m = meta[id];
            items.push({ kind: "activity", id, sortKey: m?.sortKey ?? 0, tuple, timestamp: m?.timestamp ?? 0 });
        }
        for (const entry of schemaLogs) {
            items.push({ kind: "schema", sortKey: entry._sortKey, entry });
        }
        items.sort((a, b) => b.sortKey - a.sortKey);
        return items;
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
            modalTitle = "ActivityStreams Data Exchange";
            logModalState = true;
            jsonSend = JSON.stringify(logs[indexSend][0], null, 2);
            jsonResp = JSON.stringify(logs[indexResp][1] || {}, null, 2);
        };
    }

    function showSchemaLog(entry: SchemaLogEntry) {
        return () => {
            modalTitle = `Schema Event: ${entry._logType}`;
            logModalState = true;
            jsonSend = JSON.stringify(entry.payload, null, 2);
            jsonResp = "";
        };
    }
</script>

<div class="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
    <div class="flex items-center justify-between mb-4">
        <div>
            <h3 class="text-xl font-bold text-gray-900 flex items-center">
                <span class="mr-2">📡</span>
                Sockethub Activity Log
            </h3>
            <p class="text-gray-600 text-sm mt-1">
                Real-time communication between your browser and Sockethub server
            </p>
        </div>
        <div class="flex items-center space-x-4 text-xs">
            <div class="flex items-center space-x-1">
                <div class="w-3 h-3 bg-orange-400 rounded-full"></div>
                <span class="text-gray-600">Pending</span>
            </div>
            <div class="flex items-center space-x-1">
                <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                <span class="text-gray-600">Complete</span>
            </div>
            <div class="flex items-center space-x-1">
                <div class="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <span class="text-gray-600">Schema</span>
            </div>
        </div>
    </div>
    
    <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div class="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <p class="text-sm text-gray-700">
                💡 <strong>How to read this log:</strong> Each entry shows messages sent to and received from Sockethub. 
                Click "View Details" to see the full JSON data being exchanged.
            </p>
        </div>
        
        <div id="messages" class="max-h-96 overflow-y-auto">
            {#if unified.length === 0}
                <div class="p-8 text-center text-gray-500">
                    <div class="text-4xl mb-2">📭</div>
                    <p class="font-medium">No activity yet</p>
                    <p class="text-sm">Activity will appear here when you interact with Sockethub</p>
                </div>
            {:else}
                <ul class="divide-y divide-gray-100">
                    {#each unified as item (item.kind === "schema" ? item.entry._logId : item.id)}
                        {#if item.kind === "schema"}
                            <SchemaLogEntryComponent entry={item.entry} buttonAction={showSchemaLog(item.entry)} />
                        {:else if Array.isArray(item.tuple[item.tuple.length - 1])}
                            {#each Object.entries(item.tuple[item.tuple.length - 1]) as [s, r]}
                                {#if r}
                                    <LogEntry
                                        buttonAction={showLog(`${item.id}-${s}`)}
                                        hasSend={Object.prototype.hasOwnProperty.call(item.tuple[0], "@context")}
                                        hasResponse={typeof logs[item.id][1] !== "undefined"}
                                        id={`${item.id}-${s}`}
                                        entry={r}
                                        timestamp={item.timestamp}
                                    />
                                {/if}
                            {/each}
                        {:else}
                            {@const hasSend = Object.prototype.hasOwnProperty.call(item.tuple[0], "@context")}
                            {@const hasResponse = Object.prototype.hasOwnProperty.call(item.tuple[1], "@context")}
                            <LogEntry
                                buttonAction={showLog(item.id)}
                                id={item.id}
                                {hasSend}
                                {hasResponse}
                                entry={hasResponse ? item.tuple[1] : item.tuple[0]}
                                timestamp={item.timestamp}
                            />
                        {/if}
                    {/each}
                </ul>
            {/if}
        </div>
    </div>
</div>

<div
    class="{logModalState
        ? 'flex items-center justify-center'
        : 'hidden'} bg-black bg-opacity-50 fixed top-0 left-0 w-full h-full z-50 p-4"
>
    <div class="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Modal Header -->
        <div class="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold text-gray-900 flex items-center">
                    <span class="mr-2">🔍</span>
                    {modalTitle}
                </h3>
                <button
                    onclick={() => (logModalState = false)}
                    class="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <p class="text-gray-600 text-sm mt-1">
                Raw JSON data showing the ActivityStreams message exchange with Sockethub
            </p>
        </div>
        
        <!-- Modal Content -->
        <div class="flex-1 overflow-auto p-6 space-y-6">
            <div class="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                <h4 class="font-semibold text-blue-900 mb-3 flex items-center">
                    <span class="mr-2">{jsonResp ? '📤' : '📋'}</span>
                    {jsonResp ? 'Sent to Sockethub' : 'Event Payload'}
                </h4>
                <div class="bg-white rounded border border-blue-200 overflow-hidden">
                    <Highlight language={json} code={jsonSend} />
                </div>
            </div>

            {#if jsonResp}
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                <h4 class="font-semibold text-green-900 mb-3 flex items-center">
                    <span class="mr-2">📥</span>
                    Response from Sockethub
                </h4>
                <div class="bg-white rounded border border-green-200 overflow-hidden">
                    <Highlight language={json} code={jsonResp} />
                </div>
            </div>
            {/if}
        </div>
        
        <!-- Modal Footer -->
        <div class="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
                onclick={() => (logModalState = false)}
                class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
                Close
            </button>
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
