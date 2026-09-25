<script lang="ts">
import { apiDiscovery } from "$lib/api-discovery";
// Importing the client module starts discovery and fills the store.
import "$lib/sockethub";
</script>

<div class="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-r-lg" data-testid="api-info">
    <h2 class="text-xl font-semibold text-gray-800 mb-2">This Server</h2>
    {#if !$apiDiscovery}
        <p class="text-gray-600 text-sm">Discovering server endpoints…</p>
    {:else if $apiDiscovery.state === "available"}
        {@const { descriptor, serverOrigin } = $apiDiscovery}
        <dl class="text-sm text-gray-700 space-y-2">
            {#if descriptor.endpoints}
                <div>
                    <dt class="font-semibold inline">Socket.IO endpoint:</dt>
                    <dd class="inline">
                        <code data-testid="api-info-socket">io({JSON.stringify(serverOrigin)}, &#123; path: {JSON.stringify(descriptor.endpoints.socketIO)} &#125;)</code>
                    </dd>
                </div>
            {/if}
            <div>
                <dt class="font-semibold inline">HTTP actions endpoint:</dt>
                <dd class="inline">
                    {#if descriptor.endpoints?.httpActions}
                        <code data-testid="api-info-endpoint">{new URL(descriptor.endpoints.httpActions, serverOrigin).href}</code>
                    {:else}
                        <span data-testid="api-info-endpoint-off">not enabled on this server</span>
                    {/if}
                </dd>
            </div>
            <div>
                <dt class="font-semibold inline">Sockethub API version:</dt>
                <dd class="inline" data-testid="api-info-version">{descriptor.apiVersion}</dd>
            </div>
            <div>
                <dt class="font-semibold">Enabled platforms:</dt>
                <dd>
                    <ul class="mt-1 flex flex-wrap gap-2" data-testid="api-info-platforms">
                        {#each descriptor.platforms as platform (platform.id)}
                            <li class="bg-white border rounded px-2 py-1">
                                {platform.id}
                                <span class="text-gray-500">API v{platform.apiVersion}</span>
                            </li>
                        {/each}
                    </ul>
                </dd>
            </div>
        </dl>
    {:else}
        <div class="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded p-2" data-testid="api-info-unavailable">
            <strong>Server discovery failed.</strong>
            {$apiDiscovery.reason}
        </div>
    {/if}
</div>
