<script lang="ts" module>
import type { AnyActivityStream } from "$lib/sockethub";
import { writable } from "svelte/store";
import { resolveLogDetails, type LogMetadata } from "./log-details";

type LogEntries = Record<
    string,
    [
        AnyActivityStream | Record<string, never>,
        AnyActivityStream | Record<string, never>,
    ]
>;
const Logs = writable({} as LogEntries);
const LogMeta = writable({} as Record<string, LogMetadata>);
let counter = 0;

type ObjectType = "SEND" | "RESP";

export function addObject(
    type: ObjectType,
    obj: AnyActivityStream,
    isBatch = false,
    requestId?: string,
): AnyActivityStream {
    let index: string;
    const sortKey = ++counter;

    if (obj.id) {
        index = obj.id;
    } else {
        index = `${sortKey}`;
    }

    obj.id = index;

    if (isBatch) {
        index = `${index}-${++counter}`;
    }

    const now = Date.now();
    LogMeta.update((meta) => {
        if (!meta[index]) {
            meta[index] = { timestamp: now, sortKey, requestId };
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
    import MetadataPreview, { isPageObject, type PageObject } from "../MetadataPreview.svelte";
    import LogEntry from "./LogEntry.svelte";
    import Icon from "../Icon.svelte";
    import SchemaLogEntryComponent from "./SchemaLogEntry.svelte";
    import Highlight from "svelte-highlight";
    import json from "svelte-highlight/languages/json";

    type UnifiedEntry =
        | { kind: "activity"; id: string; sortKey: number; timestamp: number; tuple: [AnyActivityStream | Record<string, never>, AnyActivityStream | Record<string, never>] }
        | { kind: "schema"; sortKey: number; entry: SchemaLogEntry };

    let logs: LogEntries = $state({} as LogEntries);
    let meta: Record<string, LogMetadata> = $state({});
    let schemaLogs: SchemaLogEntry[] = $state([]);
    let logModalState = $state(false);
    let jsonSend = $state("");
    let jsonResp = $state("");
    let modalTitle = $state("Message details");
    /** Page object from the response shown in the modal, for a rendered preview. */
    let modalPage: PageObject | undefined = $state();

    Logs.subscribe((data: LogEntries) => {
        logs = data;
    });
    LogMeta.subscribe((data: Record<string, LogMetadata>) => {
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
            const { sent, response } = resolveLogDetails(logs, meta, uid);
            modalTitle = "Message details";
            logModalState = true;
            jsonSend = sent ? JSON.stringify(sent, null, 2) : "";
            jsonResp =
                response && Object.keys(response as object).length > 0
                    ? JSON.stringify(response, null, 2)
                    : "";
            const object = (response as AnyActivityStream | undefined)?.object;
            modalPage = isPageObject(object) ? object : undefined;
        };
    }

    function showSchemaLog(entry: SchemaLogEntry) {
        return () => {
            modalTitle = "Client event";
            logModalState = true;
            jsonSend = JSON.stringify(entry.payload, null, 2);
            jsonResp = "";
            modalPage = undefined;
        };
    }
</script>

<section class="card flex flex-col overflow-hidden xl:max-h-[calc(100vh-4rem)]">
    <header class="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
        <div class="min-w-0">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Icon name="activity" class="size-4 text-brand-600" />
                Activity log
                {#if unified.length > 0}
                    <span class="rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-500 tabular-nums">{unified.length}</span>
                {/if}
            </h2>
            <p class="mt-0.5 text-[13px] text-zinc-500">
                Every message this page sends to Sockethub, and what comes back. Open an entry for the full JSON.
            </p>
        </div>
    </header>
    <div class="flex items-center gap-4 border-b border-zinc-100 bg-zinc-50/60 px-5 py-2 text-[11px] text-zinc-500">
        <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-amber-500"></span>Waiting</span>
        <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-emerald-500"></span>Answered</span>
        <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-red-500"></span>Error</span>
        <span class="flex items-center gap-1.5"><span class="size-1.5 rounded-full bg-sky-500"></span>Client event</span>
    </div>

    <div id="messages" class="max-h-[28rem] min-h-0 flex-1 overflow-y-auto xl:max-h-none">
        {#if unified.length === 0}
            <div class="flex flex-col items-center px-6 py-12 text-center">
                <span class="flex size-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                    <Icon name="inbox" class="size-5" />
                </span>
                <p class="mt-3 text-sm font-medium text-zinc-700">No activity yet</p>
                <p class="mt-1 max-w-56 text-[13px] text-zinc-500">Messages appear here as soon as you send one.</p>
            </div>
        {:else}
            <ul class="divide-y divide-zinc-100">
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
                            entry={(hasResponse
                                ? item.tuple[1]
                                : item.tuple[0]) as AnyActivityStream}
                            timestamp={item.timestamp}
                        />
                    {/if}
                {/each}
            </ul>
        {/if}
    </div>
</section>

{#if logModalState}
<div
    class="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
    role="presentation"
    onclick={(e) => e.target === e.currentTarget && (logModalState = false)}
>
    <div
        class="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-modal-title"
    >
        <div class="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 sm:px-6">
            <div>
                <h3 id="log-modal-title" class="text-base font-semibold text-zinc-900">{modalTitle}</h3>
                <p class="mt-0.5 text-[13px] text-zinc-500">
                    {jsonResp ? "The ActivityStreams message your page sent, and Sockethub's reply." : "The payload of this client event."}
                </p>
            </div>
            <button
                type="button"
                aria-label="Close activity log details"
                onclick={() => (logModalState = false)}
                class="-mr-2 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
                <Icon name="x" class="size-5" />
            </button>
        </div>

        <div class="flex-1 space-y-5 overflow-auto px-5 py-5 sm:px-6">
            {#if modalPage}
                <div>
                    <h4 class="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Rendered preview</h4>
                    <MetadataPreview page={modalPage} />
                </div>
            {/if}

            <div>
                <h4 class="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                    {#if jsonResp}<Icon name="up" class="size-3.5 text-brand-600" /> Sent to Sockethub{:else}Event payload{/if}
                </h4>
                <div class="code-block overflow-hidden rounded-lg border border-zinc-200 text-[13px]">
                    <Highlight language={json} code={jsonSend} />
                </div>
            </div>

            {#if jsonResp}
                <div>
                    <h4 class="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        <Icon name="down" class="size-3.5 text-emerald-600" /> Response from Sockethub
                    </h4>
                    <div class="code-block overflow-hidden rounded-lg border border-zinc-200 text-[13px]">
                        <Highlight language={json} code={jsonResp} />
                    </div>
                </div>
            {/if}
        </div>

        <div class="flex justify-end border-t border-zinc-200 bg-zinc-50 px-5 py-3 sm:px-6">
            <button type="button" onclick={() => (logModalState = false)} class="btn btn-secondary">Close</button>
        </div>
    </div>
</div>
{/if}

<svelte:window onkeydown={(e) => logModalState && e.key === "Escape" && (logModalState = false)} />

<svelte:head>
    {#if logModalState}
        <style>
            body {
                overflow: hidden;
            }
        </style>
    {/if}
</svelte:head>
