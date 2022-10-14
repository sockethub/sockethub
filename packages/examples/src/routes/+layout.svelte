<script>
	import "../app.css";
	import edgeLight from "svelte-highlight/styles/edge-light";
	import ConnectStatus from "../components/ConnectWidget.svelte";
	import Nav from "../components/Nav.svelte";


</script>

<svelte:head>
	{@html edgeLight}
</svelte:head>

<main>
	<div class="grid grid-cols-4 gap-4">
		<div class="md:ml-2 md:mt-1">
			<img class="md:float-right" src="/sockethub-logo.svg" alt="Sockethub"/>
		</div>
		<div class="col-span-2 md:mt-3">
			<Nav />
		</div>
		<div class="md:mt-2">
			<ConnectStatus />
		</div>
	</div>
	<div class="grid grid-cols-8 gap-4">
		<slot/>
	</div>
</main>
