<script lang="ts">
import { base } from "$app/paths";
import { page } from "$app/stores";
import { apiDiscovery } from "$lib/api-discovery";
// Importing the client module starts discovery and fills the store.
import "$lib/sockethub";

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

// Platforms the server reports in its service descriptor. Platform links stay
// disabled until discovery has answered, and all of them if it failed.
const enabledPlatforms = $derived(
    $apiDiscovery?.state === "available"
        ? new Set($apiDiscovery.descriptor.platforms.map((p) => p.id))
        : $apiDiscovery
          ? new Set<string>()
          : undefined,
);

function isEnabled(platform: string | undefined): boolean {
    return !platform || (enabledPlatforms?.has(platform) ?? false);
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
