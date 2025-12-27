<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import DummyEntry from "./platforms/DummyEntry.svelte";
import FeedsEntry from "./platforms/FeedsEntry.svelte";
import GenericEntry from "./platforms/GenericEntry.svelte";

interface Props {
    id: string;
    entry: AnyActivityStream;
    buttonAction: () => void;
    response: boolean;
}

let { id, entry, buttonAction, response }: Props = $props();
</script>

<li class="p-4 hover:bg-gray-50 transition-colors">
    <div class="flex items-start space-x-3">
        <!-- Status Indicator -->
        <div class="flex flex-col items-center space-y-1 mt-1">
            <div class="w-3 h-3 {response ? 'bg-green-500' : 'bg-orange-400'} rounded-full"></div>
            <div class="text-xs text-gray-400 font-mono">#{id}</div>
        </div>
        
        <!-- Content -->
        <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-2">
                    <span class="text-sm font-semibold text-gray-700">
                        {response ? '📥 Response' : '📤 Sent'}
                    </span>
                    {#if entry.context}
                        <span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            {entry.context.toUpperCase()}
                        </span>
                    {/if}
                    {#if entry.type}
                        <span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                            {entry.type}
                        </span>
                    {/if}
                </div>
                
                <button
                    onclick={buttonAction}
                    class="px-3 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors flex items-center space-x-1"
                >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                    </svg>
                    <span>View Details</span>
                </button>
            </div>
            
            <!-- Platform-specific content -->
            <div class="text-sm text-gray-600">
                {#if entry.context === "dummy"}
                    <DummyEntry {id} {entry} />
                {:else if entry.context === "feeds"}
                    <FeedsEntry {id} {entry} />
                {:else}
                    <GenericEntry {id} {entry} />
                {/if}
            </div>
            
            <!-- Error display -->
            {#if entry.error}
                <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-red-800 font-medium text-sm">Error:</span>
                        <span class="text-red-700 text-sm">{entry.error}</span>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</li>
