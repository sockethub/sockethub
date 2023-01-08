<Intro title="Dummy Platform Example">
	<title>Dummy Example</title>
	<p>The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back.</p>
	<p>You can use either the echo or fail types on your Activity Stream object.</p>
</Intro>

<ActivityActor actor={actor} />

<div>
	<div class="w-full p-2">
		<label for="objectContent" class="inline-block text-gray-900 font-bold w-32">Message Content</label>
		<input id="objectContent" bind:value={content} class="border-4" placeholder="Text to send as content">
	</div>
	<div class="w-full p-2">
		<label for="sendEcho" class="inline-block text-gray-900 font-bold w-32">Object Type</label>
		<div class="flex gap-4">
			<div id="sendEcho">
				<SockethubButton disabled={!$actor.state.actorSet} buttonAction={sendEcho}>Echo</SockethubButton>
				<SockethubButton disabled={!$actor.state.actorSet} buttonAction={sendFail}>Fail</SockethubButton>
			</div>
		</div>
	</div>
</div>

<Logger />

<script lang="ts">
	import Intro from "../../components/Intro.svelte";
	import ActivityActor from "../../components/ActivityActor.svelte";
	import SockethubButton from "../../components/SockethubButton.svelte";
	import Logger, { addObject, ObjectType } from "../../components/logs/Logger.svelte";
	import { send } from "$lib/sockethub";
	import type { AnyActivityStream } from "$lib/sockethub";
	import { getActorStore } from "$stores/ActorStore";

	const actorId = 'https://sockethub.org/examples/dummyUser';
	const actor = getActorStore('dummy', {
		state: {
			actorSet: false
		},
		object: {
			id: actorId,
			type: "person",
			name: "Sockethub Examples Dummy"
		}
	});

	let content = "";

	function getASObj(type) {
		return {
			context: "dummy",
			type: type,
			actor: actorId,
			object: {
				type: 'message',
				content: content
			}
		};
	}

	function sendEcho() {
		send(getASObj("echo") as AnyActivityStream);
	}

	function sendFail() {
		send(getASObj("fail") as AnyActivityStream);
	}
</script>
