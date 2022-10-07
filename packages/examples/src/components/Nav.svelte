<script>
 const navItems = [
	 ['Home', '/'],
	 ['Dummy', '/dummy'],
	 ['Feeds', '/feeds'],
	 ['IRC', '/irc'],
	 ['XMPP', '/xmpp']
 ]
</script>
<nav class="flex sm:justify-center space-x-4">
	{#each navItems as [title, path]}
		<a class="rounded-lg px-3 py-2 text-slate-700 font-medium hover:bg-slate-100 hover:text-slate-900" href={path}>{title}</a>
	{/each}
</nav>
