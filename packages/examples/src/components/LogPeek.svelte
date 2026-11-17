<script lang="ts">
import { get } from "svelte/store";
import Icon from "./Icon.svelte";
import { lastEvent } from "./logs/Logger.svelte";

/**
 * On screens where the activity log sits below the steps, a small pill
 * reports the latest request or reply and links down to the log, so a tap
 * on a button always has a visible result.
 */
const startSeq = get(lastEvent)?.seq ?? 0;
let visible = $state(false);
let logInView = $state(false);
let timer: ReturnType<typeof setTimeout> | undefined;

const event = $derived(
    $lastEvent && $lastEvent.seq > startSeq ? $lastEvent : undefined,
);

$effect(() => {
    if (!event) return;
    visible = true;
    clearTimeout(timer);
    if (event.state !== "waiting") {
        timer = setTimeout(() => (visible = false), 6000);
    }
    return () => clearTimeout(timer);
});

$effect(() => {
    const el = document.getElementById("activity-log");
    if (!el) return;
    const observer = new IntersectionObserver(
        ([entry]) => (logInView = entry.isIntersecting),
        { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
});

const label = $derived(
    event?.state === "waiting"
        ? "Waiting for a reply…"
        : event?.state === "error"
          ? "Error reply"
          : "Reply received",
);
</script>

{#if event && visible && !logInView}
    <a
        href="#activity-log"
        onclick={() => (visible = false)}
        class="fixed inset-x-4 bottom-4 z-30 flex items-center gap-3 rounded-xl border border-zinc-200 bg-white/95 px-4 py-3 text-sm text-zinc-800 no-underline shadow-lg backdrop-blur xl:hidden"
        aria-live="polite"
    >
        <span
            class="size-2 shrink-0 rounded-full {event.state === 'waiting'
                ? 'animate-pulse bg-amber-500'
                : event.state === 'error'
                  ? 'bg-red-500'
                  : 'bg-emerald-500'}"
        ></span>
        <code class="rounded bg-zinc-100 px-1.5 py-0.5 text-[12px] font-medium">{event.type}</code>
        <span class="min-w-0 flex-1 truncate">{label}</span>
        <span class="flex shrink-0 items-center gap-1 text-[13px] font-medium text-zinc-500">
            View log
            <Icon name="arrow" class="size-3.5 rotate-90" />
        </span>
    </a>
{/if}
