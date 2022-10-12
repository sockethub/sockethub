<script>
	import { page } from '$app/stores';
	const navItems = [
	 ['Home', '/'],
	 ['Dummy', '/dummy'],
	 ['Feeds', '/feeds'],
	 ['IRC', '/irc'],
	 ['XMPP', '/xmpp']
  ];
</script>
<nav class="flex sm:justify-center space-x-4 p-2">
	{#each navItems as [title, path]}
		<a class="rounded-lg px-2 pt-1 pb-1.5 font-medium  {$page.url.pathname === path ? 'bg-sockethub text-blue-50' : 'text-slate-700 hover:bg-slate-300'}" href={path}>{title}</a>
	{/each}
</nav>
