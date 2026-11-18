<script lang="ts">
import { connected } from "$lib/sockethub";
</script>

<!-- Live status of this page's Socket.IO connection to the Sockethub server. -->
<div
    class="flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium {$connected
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-zinc-200 bg-zinc-50 text-zinc-600'}"
    title={$connected ? "This page is connected to the Sockethub server" : "Make sure the Sockethub server is running"}
>
    <span class="relative flex size-2">
        {#if $connected}
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
        {/if}
        <span class="relative inline-flex size-2 rounded-full {$connected ? 'bg-emerald-500' : 'bg-zinc-400'}"></span>
    </span>
    {$connected ? "Sockethub connected" : "Not connected"}
</div>
