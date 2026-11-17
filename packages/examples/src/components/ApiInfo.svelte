<script lang="ts">
import { apiDiscovery, sortPlatforms } from "$lib/api-discovery";
import { resolveEndpoint } from "@sockethub/client";
// Importing the client module starts discovery and fills the store.
import "$lib/sockethub";
import Icon from "./Icon.svelte";
</script>

<div class="card overflow-hidden" data-testid="api-info">
    <div class="flex items-center gap-3 border-b border-zinc-200 px-5 py-4 sm:px-6">
        <span class="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
            <Icon name="server" class="size-4" />
        </span>
        <div>
            <h2 class="text-sm font-semibold text-zinc-900">This server</h2>
            <p class="text-[13px] text-zinc-500">What your own app needs to connect here.</p>
        </div>
    </div>
    {#if !$apiDiscovery}
        <p class="px-5 py-5 text-sm text-zinc-500 sm:px-6">Discovering server endpoints…</p>
    {:else if $apiDiscovery.state === "available"}
        {@const { descriptor, serverOrigin } = $apiDiscovery}
        <dl class="divide-y divide-zinc-100 text-sm">
            {#if descriptor.endpoints}
                <div class="grid gap-1 px-5 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:px-6">
                    <dt class="text-zinc-500">Socket.IO endpoint</dt>
                    <dd class="min-w-0 [overflow-wrap:anywhere]">
                        <code class="text-zinc-800" data-testid="api-info-socket">io({JSON.stringify(serverOrigin)}, &#123; path: {JSON.stringify(descriptor.endpoints.socketIO)} &#125;)</code>
                    </dd>
                </div>
            {/if}
            <div class="grid gap-1 px-5 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:px-6">
                <dt class="text-zinc-500">HTTP actions endpoint</dt>
                <dd class="min-w-0 [overflow-wrap:anywhere]">
                    {#if descriptor.endpoints?.httpActions}
                        <code class="text-zinc-800" data-testid="api-info-endpoint">{resolveEndpoint(serverOrigin, descriptor.endpoints.httpActions)}</code>
                    {:else}
                        <span class="text-zinc-500" data-testid="api-info-endpoint-off">Not enabled on this server</span>
                    {/if}
                </dd>
            </div>
            <div class="grid gap-1 px-5 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:px-6">
                <dt class="text-zinc-500">Sockethub API version</dt>
                <dd class="text-zinc-800" data-testid="api-info-version">{descriptor.apiVersion}</dd>
            </div>
            <div class="grid gap-2 px-5 py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:px-6">
                <dt class="text-zinc-500">Enabled platforms</dt>
                <dd>
                    <ul class="flex flex-wrap gap-1.5" data-testid="api-info-platforms">
                        {#each sortPlatforms(descriptor.platforms) as platform (platform.id)}
                            <li class="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[13px] text-zinc-700">
                                {platform.id}
                                <span class="text-zinc-500">v{platform.apiVersion}</span>
                            </li>
                        {/each}
                    </ul>
                </dd>
            </div>
        </dl>
    {:else}
        <div class="p-5 sm:p-6">
            <div class="callout callout-warn" data-testid="api-info-unavailable">
                <Icon name="alert" class="mt-0.5 size-4 shrink-0" />
                <p><strong>Server discovery failed.</strong> {$apiDiscovery.reason}</p>
            </div>
        </div>
    {/if}
</div>
