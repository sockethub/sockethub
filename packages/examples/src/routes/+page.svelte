<script lang="ts">
import { base } from "$app/paths";
import ApiInfo from "$components/ApiInfo.svelte";
import Icon, { type IconName } from "$components/Icon.svelte";
import { apiDiscovery } from "$lib/api-discovery";
import { exampleGroups } from "$lib/examples";
import Highlight from "svelte-highlight";
import json from "svelte-highlight/languages/json";

const sample = `{
  "@context": ["https://www.w3.org/ns/activitystreams", "…/irc"],
  "type": "send",
  "actor":  { "id": "alice@irc.libera.chat", "type": "person" },
  "target": { "id": "#sockethub@irc.libera.chat", "type": "room" },
  "object": { "type": "message", "content": "Hello!" }
}`;

const concepts: { icon: IconName; term: string; text: string }[] = [
    {
        icon: "user",
        term: "Actor",
        text: "Who is acting: your IRC nick, your Jabber address, or the URL of a feed.",
    },
    {
        icon: "zap",
        term: "Activity",
        text: "What to do: connect, join, send, fetch. The type field of every message.",
    },
    {
        icon: "server",
        term: "Platform",
        text: "The Sockethub module that speaks one protocol, such as IRC or CalDAV.",
    },
    {
        icon: "key",
        term: "Credentials",
        text: "Logins you hand over once per session. They never travel inside an activity.",
    },
];

const enabled = $derived(
    $apiDiscovery?.state === "available"
        ? new Set($apiDiscovery.descriptor.platforms.map((p) => p.id))
        : undefined,
);
</script>

<svelte:head>
    <title>Sockethub Examples</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
    <!-- Hero -->
    <section class="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
        <div>
            <p class="eyebrow">Interactive examples</p>
            <h1 class="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight text-zinc-900 sm:text-5xl">Sockethub Examples</h1>
            <p class="mt-5 text-lg leading-relaxed text-zinc-600">
                Sockethub lets a web page talk to IRC, XMPP, email, feeds, calendars, and more.
                Your app sends one kind of JSON message over a WebSocket, and Sockethub speaks each protocol for you.
            </p>
            <p class="mt-3 text-base leading-relaxed text-zinc-500">
                Each example below runs against this server. Fill in a form, press a button,
                and watch the exact messages go back and forth.
            </p>
            <div class="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href="{base}/dummy" class="btn btn-primary px-5 no-underline">
                    Start with the Dummy example
                    <Icon name="arrow" class="size-4" />
                </a>
                <a href="https://github.com/sockethub/sockethub/blob/master/docs/client-guide.md" target="_blank" rel="noreferrer" class="btn btn-secondary px-5 no-underline">
                    <Icon name="book" class="size-4" />
                    Read the client guide
                </a>
            </div>
        </div>

        <figure class="card overflow-hidden">
            <figcaption class="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
                <span class="text-xs font-semibold text-zinc-700">Sending a chat message to IRC</span>
                <span class="font-mono text-[11px] text-zinc-400">ActivityStreams JSON</span>
            </figcaption>
            <div class="code-block text-[12.5px] leading-relaxed sm:text-[13px]">
                <Highlight language={json} code={sample} />
            </div>
        </figure>
    </section>

    <!-- How it works -->
    <section class="mt-16 lg:mt-20" aria-labelledby="how-heading">
        <h2 id="how-heading" class="text-xl font-semibold tracking-tight text-zinc-900">How it works</h2>
        <ol class="mt-5 grid gap-3 md:grid-cols-3 md:gap-0">
            {#each [
                { icon: "code", title: "Your web app", text: "Sends an activity with the Sockethub client over Socket.IO." },
                { icon: "server", title: "Sockethub", text: "Validates it and hands it to the right platform, in its own process." },
                { icon: "chat", title: "The network", text: "IRC, XMPP, IMAP, CalDAV… Replies come back to you as activities." },
            ] as step, i (step.title)}
                <li class="relative flex gap-4 rounded-xl border border-zinc-200 bg-white p-5 md:rounded-none md:border-r-0 md:first:rounded-l-xl md:last:rounded-r-xl md:last:border-r">
                    <span class="flex size-9 shrink-0 items-center justify-center rounded-lg {i === 1 ? 'bg-brand-50 text-brand-600' : 'bg-zinc-100 text-zinc-600'}">
                        <Icon name={step.icon as IconName} class="size-[18px]" />
                    </span>
                    <div>
                        <h3 class="text-sm font-semibold text-zinc-900">{step.title}</h3>
                        <p class="mt-1 text-sm leading-relaxed text-zinc-500">{step.text}</p>
                    </div>
                    {#if i < 2}
                        <span class="absolute top-1/2 -right-3 z-10 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 md:flex">
                            <Icon name="arrow" class="size-3.5" />
                        </span>
                    {/if}
                </li>
            {/each}
        </ol>

        <dl class="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {#each concepts as concept (concept.term)}
                <div>
                    <dt class="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                        <Icon name={concept.icon} class="size-4 text-brand-600" />
                        {concept.term}
                    </dt>
                    <dd class="mt-1.5 text-sm leading-relaxed text-zinc-500">{concept.text}</dd>
                </div>
            {/each}
        </dl>
    </section>

    <!-- Catalog -->
    <section class="mt-16 lg:mt-20" aria-labelledby="examples-heading">
        <div class="flex flex-wrap items-end justify-between gap-2">
            <h2 id="examples-heading" class="text-xl font-semibold tracking-tight text-zinc-900">Pick an example</h2>
            <p class="text-sm text-zinc-500">Greyed-out examples are not enabled on this server.</p>
        </div>
        <div class="mt-6 space-y-8">
            {#each exampleGroups as group (group.label)}
                <div>
                    <h3 class="text-[11px] font-semibold tracking-[0.08em] text-zinc-400 uppercase">{group.label}</h3>
                    <ul class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {#each group.items as item (item.path)}
                            {@const off = enabled !== undefined && !enabled.has(item.platform)}
                            {@const featured = item.platform === "dummy"}
                            <li class={featured ? "sm:col-span-2 lg:col-span-3" : ""}>
                                <a
                                    href={off ? undefined : `${base}${item.path}`}
                                    aria-disabled={off || undefined}
                                    class="group flex h-full gap-4 rounded-xl border bg-white p-4 no-underline sm:p-5 transition-all {off
                                        ? 'cursor-not-allowed border-zinc-200 opacity-50'
                                        : featured
                                          ? 'border-brand-200 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-brand-100 hover:border-brand-500'
                                          : 'border-zinc-200 shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-zinc-300 hover:shadow-md'}"
                                >
                                    <span class="flex size-10 shrink-0 items-center justify-center rounded-lg {featured ? 'bg-brand-50 text-brand-600' : 'bg-zinc-100 text-zinc-600'}">
                                        <Icon name={item.icon} class="size-5" />
                                    </span>
                                    <span class="flex min-w-0 flex-1 flex-col">
                                        <span class="flex items-center gap-2">
                                            <span class="font-semibold text-zinc-900">{item.title}</span>
                                            {#if featured}
                                                <span class="chip bg-brand-50 text-brand-700">Start here</span>
                                            {/if}
                                            {#if off}
                                                <span class="chip bg-zinc-100 text-zinc-500">Not enabled</span>
                                            {/if}
                                        </span>
                                        <span class="mt-1 text-sm leading-relaxed text-zinc-500">{item.summary}</span>
                                        <span class="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                                            {#each item.activities as activity (activity)}
                                                <code class="tok">{activity}</code>
                                            {/each}
                                        </span>
                                        <span class="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                                            <Icon name={item.needsAccount ? "key" : "check"} class="size-3.5 {item.needsAccount ? 'text-zinc-400' : 'text-emerald-600'}" />
                                            {item.needsAccount ? "Needs your own account" : "No account needed"}
                                        </span>
                                    </span>
                                    {#if !off}
                                        <Icon name="arrow" class="mt-0.5 size-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-600" />
                                    {/if}
                                </a>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/each}
        </div>
    </section>

    <section class="mt-16 lg:mt-20">
        <ApiInfo />
    </section>
</div>
