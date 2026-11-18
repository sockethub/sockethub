<script lang="ts">
import "../app.css";
import { base } from "$app/paths";
import { page } from "$app/stores";
import ConnectStatus from "$components/ConnectWidget.svelte";
import Icon from "$components/Icon.svelte";
import Nav from "$components/Nav.svelte";
import githubLight from "svelte-highlight/styles/github";

interface Props {
    children?: import("svelte").Snippet;
}

let { children }: Props = $props();
let menuOpen = $state(false);
let drawer: HTMLDialogElement | undefined = $state();

// The drawer is hidden at the desktop breakpoint, so close it there too;
// a hidden modal dialog would still block the rest of the page.
$effect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
        if (e.matches) menuOpen = false;
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
});

// Keep the native dialog in step with menuOpen.
$effect(() => {
    if (!drawer) return;
    if (menuOpen && !drawer.open) drawer.showModal();
    if (!menuOpen && drawer.open) drawer.close();
});

// Close the drawer whenever the route changes.
$effect(() => {
    $page.url.pathname;
    menuOpen = false;
});
</script>

<svelte:head>
    {@html githubLight}
</svelte:head>

{#snippet brand()}
    <a href={base || "/"} class="flex items-center gap-2 no-underline" aria-label="Sockethub examples home">
        <img src="/sockethub-logo.svg" alt="Sockethub" class="h-6 w-auto" />
        <span class="hidden rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-500 min-[420px]:inline lg:inline">
            Examples
        </span>
    </a>
{/snippet}

{#snippet footerLinks()}
    <div class="space-y-1 border-t border-zinc-200 pt-4 text-sm">
        <a class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-500 no-underline hover:bg-zinc-100 hover:text-zinc-900" href="https://github.com/sockethub/sockethub/blob/master/docs/client-guide.md" target="_blank" rel="noreferrer">
            <Icon name="book" class="size-4" /> Client guide
        </a>
        <a class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-zinc-500 no-underline hover:bg-zinc-100 hover:text-zinc-900" href="https://github.com/sockethub/sockethub" target="_blank" rel="noreferrer">
            <Icon name="code" class="size-4" /> Source on GitHub
        </a>
    </div>
{/snippet}

<div class="lg:grid lg:min-h-screen lg:grid-cols-[16rem_minmax(0,1fr)]">
<!-- Desktop sidebar -->
<div class="hidden border-r border-zinc-200 bg-white lg:block">
<aside class="sticky top-0 flex h-screen flex-col">
    <div class="flex h-16 shrink-0 items-center px-5">
        {@render brand()}
    </div>
    <div class="px-5 pb-3">
        <ConnectStatus />
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-3">
        <Nav />
    </div>
    <div class="px-3 pb-4">
        {@render footerLinks()}
    </div>
</aside>
</div>

<!-- Mobile top bar -->
<header class="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:hidden">
    {@render brand()}
    <div class="flex items-center gap-2">
        <ConnectStatus />
        <button
            type="button"
            class="-mr-2 rounded-lg p-2 text-zinc-600 hover:bg-zinc-100"
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            onclick={() => (menuOpen = true)}
        >
            <Icon name="menu" class="size-5" />
        </button>
    </div>
</header>

<!-- Mobile drawer. A native modal dialog moves focus in, keeps it there,
     closes on Escape, and returns focus to the menu button. -->
<dialog
    bind:this={drawer}
    onclose={() => {
        menuOpen = false;
    }}
    onclick={(e) => {
        if (e.target === drawer) menuOpen = false;
    }}
    aria-label="Navigation"
    class="m-0 ml-auto h-dvh max-h-none w-72 max-w-[85vw] bg-white p-0 shadow-xl backdrop:bg-zinc-900/40 lg:hidden"
>
    <div class="flex h-full flex-col">
        <div class="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
            <span class="text-sm font-semibold text-zinc-900">Examples</span>
            <button type="button" class="-mr-2 rounded-lg p-2 text-zinc-600 hover:bg-zinc-100" aria-label="Close navigation" onclick={() => (menuOpen = false)}>
                <Icon name="x" class="size-5" />
            </button>
        </div>
        <div class="flex-1 overflow-y-auto px-3 py-4">
            <Nav onNavigate={() => (menuOpen = false)} />
        </div>
        <div class="px-3 pb-4">
            {@render footerLinks()}
        </div>
    </div>
</dialog>

<main class="min-w-0">
    {@render children?.()}
</main>
</div>
