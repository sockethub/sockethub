<script lang="ts">
import type { SchemaLogEntry } from "./Logger.svelte";

interface Props {
    entry: SchemaLogEntry;
    buttonAction: () => void;
}

let { entry, buttonAction }: Props = $props();

const labelMap: Record<string, { label: string; color: string; bg: string }> = {
    schemas: {
        label: "Schemas Received",
        color: "text-indigo-800",
        bg: "bg-indigo-100",
    },
    ready: {
        label: "Client Ready",
        color: "text-emerald-800",
        bg: "bg-emerald-100",
    },
    init_error: {
        label: "Init Error",
        color: "text-red-800",
        bg: "bg-red-100",
    },
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
        const version = typeof p.version === "string" ? p.version : "";
        return `v${version} — ${ids.length} platform${ids.length !== 1 ? "s" : ""}: ${ids.join(", ")}`;
    }

    if (entry._logType === "ready") {
        const reason = typeof p.reason === "string" ? p.reason : "";
        const version =
            typeof p.sockethubVersion === "string" ? p.sockethubVersion : "";
        const platforms = Array.isArray(p.platforms) ? p.platforms.length : 0;
        return `${reason} — Sockethub v${version}, ${platforms} platform${platforms !== 1 ? "s" : ""}`;
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

<li class="p-4 hover:bg-indigo-50/40 transition-colors">
    <div class="flex items-start space-x-3">
        <div class="flex flex-col items-center space-y-1 mt-1">
            <div class="w-3 h-3 {entry._logType === 'init_error' ? 'bg-red-500' : 'bg-indigo-500'} rounded-full"></div>
            <div class="text-xs text-gray-400 font-mono">{time}</div>
        </div>

        <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
                <div class="flex items-center space-x-2">
                    <span class="px-2 py-1 {meta.bg} {meta.color} text-xs font-semibold rounded-full">
                        {meta.label}
                    </span>
                </div>

                <button
                    onclick={buttonAction}
                    class="px-3 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors flex items-center space-x-1"
                >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                    <span>View Details</span>
                </button>
            </div>

            <p class="text-sm text-gray-600 truncate">{summary}</p>

            {#if entry._logType === "init_error"}
                <div class="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <span class="text-red-700 text-xs">{(entry.payload as Record<string, unknown>)?.error ?? ""}</span>
                </div>
            {/if}
        </div>
    </div>
</li>
