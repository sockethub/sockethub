<script lang="ts">
/**
 * One numbered step of an example. `done` swaps the number for a check, and
 * `locked` dims the step and shows `lockedHint` until earlier steps finish.
 * `blockedHint` keeps the content visible but says what is missing.
 */
interface Props {
    n?: number | string;
    title: string;
    description?: string;
    done?: boolean;
    locked?: boolean;
    lockedHint?: string;
    /** Shown above the content (which stays visible) while a prerequisite is missing. */
    blockedHint?: string;
    /** Content placed at the right of the header, e.g. a secondary action. */
    actions?: import("svelte").Snippet;
    children?: import("svelte").Snippet;
}

let {
    n,
    title,
    description,
    done = false,
    locked = false,
    lockedHint,
    blockedHint,
    actions,
    children,
}: Props = $props();
</script>

<section class="card overflow-hidden transition-opacity {locked ? 'opacity-70' : ''}">
    <div class="flex items-start gap-3.5 px-4 pt-4 sm:gap-4 sm:px-6 sm:pt-6 {children && !(locked && lockedHint) ? '' : 'pb-4 sm:pb-6'}">
        {#if n !== undefined}
            <span
                class="mt-px flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums {done
                    ? 'bg-emerald-500 text-white'
                    : locked
                      ? 'border border-zinc-200 bg-zinc-50 text-zinc-500'
                      : 'bg-zinc-900 text-white'}"
                aria-hidden="true"
            >
                {#if done}
                    <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                {:else}
                    {n}
                {/if}
            </span>
        {/if}
        <div class="min-w-0 flex-1">
            <h2 class="text-base leading-7 font-semibold text-zinc-900">
                {title}
                {#if done}<span class="sr-only">(done)</span>{/if}
            </h2>
            {#if description}
                <p class="mt-0.5 text-sm leading-relaxed text-zinc-500">{description}</p>
            {/if}
        </div>
        {#if actions}
            <div class="shrink-0">{@render actions()}</div>
        {/if}
    </div>
    {#if locked && lockedHint}
        <p class="flex items-center gap-2 px-4 pb-4 text-sm text-zinc-500 sm:px-6 sm:pb-6 {n !== undefined ? 'sm:pl-[4.25rem]' : ''}">
            <svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            {lockedHint}
        </p>
    {:else if children}
        <div class="space-y-4 px-4 pt-4 pb-4 sm:px-6 sm:pb-6 {n !== undefined ? 'sm:pl-[4.25rem]' : ''}">
            {#if blockedHint}
                <p class="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-[13px] text-zinc-600">
                    <svg class="size-3.5 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                    {blockedHint}
                </p>
            {/if}
            {@render children()}
        </div>
    {/if}
</section>
