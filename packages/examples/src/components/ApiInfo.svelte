<script lang="ts">
import { onMount } from "svelte";
import { type ApiDiscovery, discoverApi } from "$lib/api-discovery";
import { loadExamplesConfig } from "$lib/examples-config";

let discovery: ApiDiscovery | undefined = $state();

onMount(async () => {
    try {
        discovery = await discoverApi(await loadExamplesConfig());
    } catch {
        discovery = {
            state: "unavailable",
            reason: "The examples runtime config could not be loaded.",
        };
    }
});
</script>

<div class="bg-gray-50 border-l-4 border-gray-400 p-4 rounded-r-lg" data-testid="api-info">
    <h2 class="text-xl font-semibold text-gray-800 mb-2">This Server</h2>
    {#if !discovery}
        <p class="text-gray-600 text-sm">Discovering API versions…</p>
    {:else}
        <dl class="text-sm text-gray-700 space-y-2">
            <div>
                <dt class="font-semibold inline">HTTP actions endpoint:</dt>
                <dd class="inline">
                    {#if discovery.endpoint}
                        <code data-testid="api-info-endpoint">{discovery.endpoint}</code>
                    {:else}
                        not advertised
                    {/if}
                </dd>
            </div>
            {#if discovery.state === "available"}
                <div>
                    <dt class="font-semibold inline">Sockethub API version:</dt>
                    <dd class="inline" data-testid="api-info-version">{discovery.descriptor.apiVersion}</dd>
                </div>
                <div>
                    <dt class="font-semibold">Enabled platforms:</dt>
                    <dd>
                        <ul class="mt-1 flex flex-wrap gap-2" data-testid="api-info-platforms">
                            {#each discovery.descriptor.platforms as platform (platform.id)}
                                <li class="bg-white border rounded px-2 py-1">
                                    {platform.id}
                                    <span class="text-gray-500">API v{platform.apiVersion}</span>
                                </li>
                            {/each}
                        </ul>
                    </dd>
                </div>
            {:else}
                <div class="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded p-2" data-testid="api-info-unavailable">
                    <strong>API discovery unavailable.</strong>
                    {discovery.reason}
                </div>
            {/if}
        </dl>
    {/if}
</div>
