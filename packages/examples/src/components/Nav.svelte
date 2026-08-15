<script lang="ts">
import { base } from "$app/paths";
import { page } from "$app/stores";
import { onMount } from "svelte";
import { loadRuntimeConfig, platformId } from "$lib/runtime-config";

const navItems = [
    ["🏠", "Home", "/", "Start here to understand Sockethub", undefined],
    ["🔧", "Dummy", "/dummy", "Basic examples • Start here", "dummy"],
    ["📰", "Feeds", "/feeds", "RSS/ATOM feed parsing", "feeds"],
    ["🔍", "Metadata", "/metadata", "Web page metadata extraction", "metadata"],
    ["📅", "CalDAV", "/caldav", "Calendars and tasks", "caldav"],
    ["👤", "CardDAV", "/carddav", "Address books and contacts", "carddav"],
    ["💬", "IRC", "/irc", "Internet Relay Chat • Advanced", "irc"],
    ["📨", "XMPP", "/xmpp", "Extensible messaging • Advanced", "xmpp"],
] as const;

let enabledPlatforms: Set<string> | undefined = $state();
let configLoaded = $state(false);

onMount(async () => {
    try {
        const { platforms } = await loadRuntimeConfig();
        enabledPlatforms = platforms
            ? new Set(platforms.map(platformId))
            : undefined;
    } catch {
        enabledPlatforms = new Set();
    }
    configLoaded = true;
});

function isEnabled(platform: string | undefined): boolean {
    return (
        !platform ||
        (configLoaded && (!enabledPlatforms || enabledPlatforms.has(platform)))
    );
}

function tooltip(description: string, enabled: boolean): string {
    return enabled ? description : `${description} • Platform not enabled`;
}
</script>

<nav class="flex justify-center flex-wrap gap-2 p-2">
    {#each navItems as [icon, title, path, description, platform]}
        {@const enabled = isEnabled(platform)}
        {@const classes = `group relative rounded-lg px-3 py-2 font-medium transition-all duration-200 no-underline ${
            !enabled
                ? "cursor-not-allowed text-slate-400"
                : $page.url.pathname.endsWith(path)
                  ? "bg-orange-600 text-blue-50 shadow-md"
                  : "text-slate-700 hover:bg-slate-200 hover:shadow-sm"
        }`}
        {#if enabled}
            <a class={classes} href="{base}{path}" title={tooltip(description, enabled)}>
                <span class="text-sm">{icon}</span>
                <span class="ml-1">{title}</span>
            </a>
        {:else}
            <span class={classes} title={tooltip(description, enabled)} aria-disabled="true">
                <span class="text-sm grayscale">{icon}</span>
                <span class="ml-1">{title}</span>
            </span>
        {/if}
    {/each}
</nav>
