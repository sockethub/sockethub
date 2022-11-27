<Intro title="Dummy Platform Example">
	<title>Dummy Example</title>
	<p>The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back.</p>
	<p>You can use either the echo or fail types on your Activity Stream object.</p>
</Intro>

<Module>
	<ActivityActor actor={actor} />
</Module>

<Module>
	<div class="w-16 md:w-32 lg:w-48 grow w-full">
		<label for="objectContent" class="form-label inline-block text-gray-900 font-bold mb-2">Message Content</label>
		<input id="objectContent" bind:value={content} class="border-4 grow w-full" placeholder="Text to send as content">
	</div>
	<div class="w-16 md:w-32 lg:w-48 w-full">
		<label for="sendEcho" class="form-label inline-block text-gray-900 font-bold mb-2">Object Type</label>
		<div class="flex gap-4">
			<div id="sendEcho">
				<SockethubButton disabled={!$actor.isSet} buttonAction={sendEcho}>Echo</SockethubButton>
				<SockethubButton disabled={!$actor.isSet} buttonAction={sendFail}>Fail</SockethubButton>
			</div>
		</div>
	</div>
</Module>

<Module>
	<Logger />
</Module>

<script lang="ts">
	import Intro from "../../components/Intro.svelte";
	import Module from "../../components/Module.svelte";
	import ActivityActor from "../../components/ActivityActor.svelte";
	import SockethubButton from "../../components/SockethubButton.svelte";
	import Logger, { addObject, ObjectType } from "../../components/logs/Logger.svelte";
	import { sc } from "$lib/sockethub";
	import { getActorStore } from "$stores/ActorStore";

	const defaultActorId = 'https://sockethub.org/examples/dummyUser';
	const actor = getActorStore({
		isSet: false,
		object: {
			id: defaultActorId,
			type: "person",
			name: "Sockethub Examples Dummy"
		}
	});

	let content = "";

	function send(obj) {
		sc.socket.emit('message', addObject(ObjectType.send, obj), (resp) => {
			addObject(ObjectType.resp, resp, resp.id);
		});
	}

	function getASObj(type) {
		return {
			context: "dummy",
			type: type,
			actor: defaultActorId,
			object: {
				type: 'message',
				content: content
			}
		};
	}

	function sendEcho() {
		send(getASObj("echo"))
	}

	function sendFail() {
		send(getASObj("fail"));
	}
</script>
