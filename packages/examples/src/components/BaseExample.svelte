<script lang="ts">
import { exampleFor, groupFor } from "$lib/examples";
import Icon from "./Icon.svelte";
import LogPeek from "./LogPeek.svelte";
import Logger from "./logs/Logger.svelte";

/**
 * Page frame for every platform example: a header that says what the
 * platform does, the numbered steps on the left, and the live activity log
 * beside them on wide screens (below them on narrow ones).
 *
 * @example
 * ```svelte
 * <BaseExample platform="irc" title="IRC Platform Example" description="…">
 *   <Step n={1} title="Confirm your actor">…</Step>
 * </BaseExample>
 * ```
 */
interface Props {
    /** The page heading. */
    title: string;
    /** Platform id, used for the eyebrow and the activity chips. */
    platform?: string;
    /** One or two sentences on what this example does. */
    description?: string;
    /** Optional extra context shown under the description. */
    intro?: import("svelte").Snippet;
    /** The example's steps. */
    children?: import("svelte").Snippet;
}

let { title, platform, description, intro, children }: Props = $props();
const info = $derived(platform ? exampleFor(platform) : undefined);
const group = $derived(platform ? groupFor(platform) : undefined);
</script>

<svelte:head>
    <title>{title} · Sockethub</title>
</svelte:head>

<div class="mx-auto max-w-[1440px] px-4 pt-6 pb-24 sm:px-6 sm:pt-8 lg:px-10 lg:pt-12 xl:pb-12">
    <header class="max-w-3xl">
        {#if group}
            <p class="eyebrow">{group}</p>
        {/if}
        <h1 class="mt-2 text-[1.75rem] leading-tight font-semibold tracking-tight text-zinc-900 sm:text-3xl">{title}</h1>
        {#if description}
            <p class="mt-2 text-[15px] leading-relaxed text-zinc-600 sm:mt-3 sm:text-[17px]">{description}</p>
        {/if}
        {#if info}
            <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-zinc-500">
                <span class="flex flex-wrap items-center gap-1.5">
                    Sends
                    {#each info.activities as activity (activity)}
                        <code class="tok">{activity}</code>
                    {/each}
                </span>
                <span class="hidden h-3 w-px bg-zinc-300 sm:block"></span>
                <span class="flex items-center gap-1.5">
                    <Icon name={info.needsAccount ? "key" : "check"} class="size-3.5 {info.needsAccount ? 'text-zinc-500' : 'text-emerald-600'}" />
                    {info.access}
                </span>
            </div>
        {/if}
        {#if intro}
            <div class="mt-5">{@render intro()}</div>
        {/if}
    </header>

    <div class="mt-6 grid items-start gap-4 sm:gap-6 lg:mt-10 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:gap-8">
        <div class="min-w-0 space-y-4 sm:space-y-5">
            {@render children?.()}
        </div>
        <aside class="min-w-0 xl:sticky xl:top-8" aria-label="Activity log">
            <Logger />
        </aside>
    </div>
</div>

<LogPeek />
