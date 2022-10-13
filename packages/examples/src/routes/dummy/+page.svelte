<Intro title="Dummy Platform Example">
	<title>Dummy Example</title>
	<p>The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back.</p>
	<p>You can use either the echo or fail types on your Activity Stream object.</p>
</Intro>

<Module>
	<div class="w-16 md:w-32 lg:w-48 grow w-full">
		<label for="activityStreamActor" class="form-label inline-block text-gray-900 font-bold mb-2">Activity Stream Actor</label>
		<pre><textarea
			bind:value={actorString}
			class="form-control block w-full px-3 py-1.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-blue-600 focus:outline-none"
			id="activityStreamActor" rows="5"></textarea></pre>
	</div>
	<div class="w-16 md:w-32 lg:w-48 w-full">
		<div class="flex gap-4">
			<div>
				<label for="sendASObject" class="form-label inline-block text-gray-900 font-bold mb-2">Activity Object Create</label>
				<button id="sendASObject" on:click={sendActivityObjectCreate}
								class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded"
								disabled="{!connected}">Send</button>
			</div>
		</div>
	</div>
</Module>
<Module>

	<div class="w-16 md:w-32 lg:w-48 grow w-full">
		<label for="objectContent" class="form-label inline-block text-gray-900 font-bold mb-2">Message Content</label>
		<input id="objectContent" bind:value={content} class="border-4 grow w-full" placeholder="Text to send as content">
	</div>
	<div class="w-16 md:w-32 lg:w-48 w-full">
		<label for="sendEcho" class="form-label inline-block text-gray-900 font-bold mb-2">Object Type</label>
		<div class="flex gap-4">
			<div>
				<button id="sendEcho" on:click={sendEcho}
								class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded"
								disabled="{!connected}">Echo</button>
				<button on:click={sendFail}
								class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded"
								disabled="{!connected}">Fail</button>
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
	import Logger, { addObject, ObjectType } from "../../components/Logger.svelte";
	import { connected, sc } from "$lib/sockethub";

	const activityObject = {
		context: "dummy",
		type: "",
		actor: 'https://sockethub.org/examples/dummyUser',
		object: {
			type: 'message',
			content: ""
		}
	};
	let actor = {
		id: 'https://sockethub.org/examples/dummyUser',
		type: "person",
		name: "Sockethub Examples - Dummy User"
	};
	let actorString = JSON.stringify(actor, undefined, 3).trim();

	let counter = 0;
	let content = "";

	function sendActivityObjectCreate() {
		actor = JSON.parse(actorString);
		console.log('creating activity object:  ', actor);
		sc.ActivityStreams.Object.create(actor);
	}

	function send(uid, obj) {
		obj.id = "" + uid;
		addObject(ObjectType.send, obj);
		sc.socket.emit('message', obj, (resp) => {
			resp.id = "" + uid;
			addObject(ObjectType.resp, resp);
		});
	}

	function getASObj(type) {
		const obj = {};
		Object.assign(obj, activityObject);
		obj.type = type;
		obj.object.content = content;
		return obj;
	}

	function sendEcho() {
		send(++counter, getASObj("echo"))
	}

	function sendFail() {
		send(++counter, getASObj("fail"));
	}
</script>
