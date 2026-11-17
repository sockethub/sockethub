<script lang="ts">
import { base } from "$app/paths";
import { page } from "$app/stores";
import { apiDiscovery } from "$lib/api-discovery";
import { exampleGroups } from "$lib/examples";
// Importing the client module starts discovery and fills the store.
import "$lib/sockethub";
import Icon from "./Icon.svelte";

interface Props {
    /** Called after a link is followed, so the mobile drawer can close. */
    onNavigate?: () => void;
}

let { onNavigate }: Props = $props();

// Platforms the server reports in its service descriptor. Platform links stay
// disabled until discovery has answered, and all of them if it failed.
const enabledPlatforms = $derived(
    $apiDiscovery?.state === "available"
        ? new Set($apiDiscovery.descriptor.platforms.map((p) => p.id))
        : $apiDiscovery
          ? new Set<string>()
          : undefined,
);

function isEnabled(platform: string): boolean {
    return enabledPlatforms?.has(platform) ?? false;
}

function isActive(path: string): boolean {
    const current = $page.url.pathname.replace(/\/$/, "");
    return path === "/"
        ? current === base || current === ""
        : current.endsWith(path);
}

const itemClass =
    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors";
</script>

<nav aria-label="Examples" class="space-y-6">
    <ul>
        <li>
            <a
                href={base || "/"}
                onclick={onNavigate}
                aria-current={isActive("/") ? "page" : undefined}
                class="{itemClass} {isActive('/')
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
            >
                <Icon name="home" class="size-4 shrink-0 {isActive('/') ? 'text-brand-600' : 'text-zinc-400 group-hover:text-zinc-600'}" />
                Overview
            </a>
        </li>
    </ul>
    {#each exampleGroups as group (group.label)}
        <div>
            <h2 class="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-zinc-400 uppercase">
                {group.label}
            </h2>
            <ul class="space-y-0.5">
                {#each group.items as item (item.path)}
                    {@const enabled = isEnabled(item.platform)}
                    {@const active = isActive(item.path)}
                    <li>
                        {#if enabled}
                            <a
                                href="{base}{item.path}"
                                onclick={onNavigate}
                                aria-current={active ? "page" : undefined}
                                class="{itemClass} {active
                                    ? 'bg-zinc-100 text-zinc-900'
                                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}"
                            >
                                <Icon name={item.icon} class="size-4 shrink-0 {active ? 'text-brand-600' : 'text-zinc-400 group-hover:text-zinc-600'}" />
                                {item.title}
                            </a>
                        {:else}
                            <span
                                class="{itemClass} cursor-not-allowed text-zinc-400"
                                aria-disabled="true"
                                title={enabledPlatforms ? "Not enabled on this server" : "Checking server…"}
                            >
                                <Icon name={item.icon} class="size-4 shrink-0 text-zinc-300" />
                                {item.title}
                                {#if enabledPlatforms}
                                    <span class="ml-auto text-[11px] font-normal text-zinc-400">off</span>
                                {/if}
                            </span>
                        {/if}
                    </li>
                {/each}
            </ul>
        </div>
    {/each}
</nav>
