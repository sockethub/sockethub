<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import { platformIdFromContext } from "$lib/sockethub";
import DummyEntry from "./platforms/DummyEntry.svelte";
import FeedsEntry from "./platforms/FeedsEntry.svelte";
import GenericEntry from "./platforms/GenericEntry.svelte";
import Icon from "../Icon.svelte";
interface Props {
    id: string;
    entry: AnyActivityStream;
    buttonAction: () => void;
    hasSend: boolean;
    hasResponse: boolean;
    timestamp?: number;
}

let { id, entry, buttonAction, hasSend, hasResponse, timestamp }: Props =
    $props();
const platform = $derived(platformIdFromContext(entry["@context"]));
const time = $derived(
    timestamp ? new Date(timestamp).toLocaleTimeString() : "",
);

const failed = $derived(Boolean(entry.error));
const statusLabel = $derived(
    hasSend && hasResponse
        ? failed
            ? "Sent \u2192 Error"
            : "Sent \u2192 Response OK"
        : hasSend
          ? "Sent \u2192 Awaiting response"
          : failed
            ? "Received \u2192 Error"
            : "Received",
);
const statusDot = $derived(
    failed
        ? "bg-red-500"
        : hasSend && !hasResponse
          ? "bg-amber-500 animate-pulse"
          : "bg-emerald-500",
);
const statusText = $derived(
    failed
        ? "text-red-700"
        : hasSend && !hasResponse
          ? "text-amber-700"
          : "text-emerald-700",
);
</script>

<li class="px-5 py-3 transition-colors hover:bg-zinc-50/80">
    <div class="flex items-center gap-2">
        <span class="size-1.5 shrink-0 rounded-full {statusDot}" aria-hidden="true"></span>
        {#if entry.type}
            <code class="rounded bg-zinc-100 px-1.5 py-0.5 text-[12px] font-medium text-zinc-800">{entry.type}</code>
        {/if}
        <span class="truncate text-[11px] font-medium {statusText}">{statusLabel}</span>
        <span class="ml-auto shrink-0 font-mono text-[11px] text-zinc-500 tabular-nums">{time || `#${id}`}</span>
    </div>
    <div class="mt-1 flex items-start gap-2 pl-3.5">
        <div class="line-clamp-2 min-w-0 flex-1 text-[13px] leading-relaxed break-words text-zinc-600">
            {#if platform === "dummy"}
                <DummyEntry {id} {entry} />
            {:else if platform === "feeds"}
                <FeedsEntry {id} {entry} />
            {:else}
                <GenericEntry {id} {entry} />
            {/if}
        </div>
        <button
            type="button"
            onclick={buttonAction}
            class="-mr-1.5 flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
            View JSON
            <Icon name="chevron" class="size-3.5" />
        </button>
    </div>
    {#if entry.error}
        <p class="mt-1.5 ml-3.5 flex items-start gap-1.5 rounded-md bg-red-50 px-2 py-1.5 text-[12px] leading-snug text-red-800">
            <Icon name="alert" class="mt-px size-3.5 shrink-0" />
            <span class="break-words">{entry.error}</span>
        </p>
    {/if}
</li>
