<div>
  <h3 class="py-2">Connect Status</h3>
  <span class="pt-1 pl-2 pr-2 pb-1.5 rounded-xl text-white font-bold {$connected ? 'bg-green-400' : 'bg-gray-300 '}">
    {$connected ? 'connected' : 'disconnected'}
  </span>
</div>

<script>
  import { connected } from "$lib/sockethub";
</script>
