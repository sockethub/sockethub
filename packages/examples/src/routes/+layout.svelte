<script>
	import "../app.css";
	import { base } from "$app/paths";
	import edgeLight from "svelte-highlight/styles/edge-light";
	import ConnectStatus from "../components/ConnectWidget.svelte";
	import Nav from "../components/Nav.svelte";
</script>

<svelte:head>
	{@html edgeLight}
</svelte:head>

<main>
	<div>
		<div>
			<img class="m-auto" src="{base}/sockethub-logo.svg" alt="Sockethub"/>
		</div>
		<div class="col-span-2 md:mt-3">
			<Nav />
		</div>
		<div class="w-full text-center">
			<ConnectStatus />
		</div>
	</div>
	<div class="pt-5">
		<slot/>
	</div>
</main>
