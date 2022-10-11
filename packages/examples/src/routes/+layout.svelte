<script>
	import "../app.css";
	import Nav from "../components/Nav.svelte";
	import edgeLight from "svelte-highlight/styles/edge-light";
</script>

<svelte:head>
	{@html edgeLight}
</svelte:head>

<main class="p-2">
	<Nav />
	<div class="grid grid-cols-8 gap-4">
	<slot />
	</div>
</main>
