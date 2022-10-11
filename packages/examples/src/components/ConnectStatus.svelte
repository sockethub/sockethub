<div>
  <h2 class="py-2">Status</h2>
  <span class="pt-1 pl-2 pr-2 pb-1.5 rounded-xl text-white font-bold {status ? 'bg-green-300' : 'bg-gray-300 '}">
    {status ? 'connected' : 'disconnected'}
  </span>
</div>

<script>
  export let status = false;
</script>
