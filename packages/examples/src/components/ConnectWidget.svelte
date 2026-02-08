<script>

</script>

<div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
    <div class="flex items-center justify-center space-x-3">
        <div class="flex items-center space-x-2">
            <div class="w-3 h-3 rounded-full {$connected ? 'bg-green-400 animate-pulse' : 'bg-gray-300'}"></div>
            <span class="text-sm font-medium text-gray-700">Sockethub Connection</span>
        </div>
        <span
            class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide {$connected
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-600'}"
        >
            {$connected ? "Connected" : "Disconnected"}
        </span>
    </div>
    {#if !$connected}
        <p class="text-xs text-gray-500 text-center mt-2">
            Make sure Sockethub server is running
        </p>
    {/if}
</div>
