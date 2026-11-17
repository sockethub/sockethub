<script lang="ts">
import type { SchemaLogEntry } from "./Logger.svelte";

interface Props {
    entry: SchemaLogEntry;
    buttonAction: () => void;
}

let { entry, buttonAction }: Props = $props();

const labelMap: Record<string, { label: string }> = {
    schemas: { label: "Schemas received" },
    ready: { label: "Client ready" },
    init_error: { label: "Client init error" },
};

const meta = $derived(labelMap[entry._logType] ?? labelMap.schemas);

function summarize(payload: unknown): string {
    if (!payload || typeof payload !== "object") return "";
    const p = payload as Record<string, unknown>;

    if (entry._logType === "schemas") {
        const platforms = Array.isArray(p.platforms) ? p.platforms : [];
        const ids = platforms
            .map((pl: Record<string, unknown>) => pl?.id)
            .filter(Boolean);
        const version =
            typeof p.apiVersion === "number" ? p.apiVersion : "unknown";
        return `API v${version} — ${ids.length} platform${ids.length !== 1 ? "s" : ""}: ${ids.join(", ")}`;
    }

    if (entry._logType === "ready") {
        const reason = typeof p.reason === "string" ? p.reason : "";
        const version =
            typeof p.apiVersion === "number" ? p.apiVersion : "unknown";
        const platforms = Array.isArray(p.platforms) ? p.platforms.length : 0;
        return `${reason} — Sockethub API v${version}, ${platforms} platform${platforms !== 1 ? "s" : ""}`;
    }

    if (entry._logType === "init_error") {
        const error = typeof p.error === "string" ? p.error : "unknown";
        const phase = typeof p.phase === "string" ? p.phase : "";
        const retrying = p.retrying ? " (retrying)" : "";
        return `${phase}: ${error}${retrying}`;
    }

    return JSON.stringify(payload).slice(0, 120);
}

const summary = $derived(summarize(entry.payload));
const time = $derived(new Date(entry._timestamp).toLocaleTimeString());
</script>

<li class="px-5 py-3 transition-colors hover:bg-zinc-50/80">
    <div class="flex items-center gap-2">
        <span class="size-1.5 shrink-0 rounded-full {entry._logType === 'init_error' ? 'bg-red-500' : 'bg-sky-500'}" aria-hidden="true"></span>
        <span class="text-[13px] font-medium text-zinc-800">{meta.label}</span>
        <span class="text-xs text-zinc-400">client</span>
        <span class="ml-auto font-mono text-[11px] text-zinc-400 tabular-nums">{time}</span>
    </div>
    <p class="mt-1 truncate pl-3.5 text-[13px] text-zinc-500" title={summary}>{summary}</p>
    {#if entry._logType === "init_error"}
        <p class="mt-1.5 ml-3.5 rounded-md bg-red-50 px-2 py-1.5 text-[12px] text-red-800">
            {(entry.payload as Record<string, unknown>)?.error ?? ""}
        </p>
    {/if}
    <div class="mt-1 flex justify-end">
        <button
            type="button"
            onclick={buttonAction}
            class="-mr-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
            View JSON
            <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
    </div>
</li>
