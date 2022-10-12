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
				<label class="form-label inline-block text-gray-900 font-bold mb-2">Activity Object Create</label>
				<button on:click={sendActivityObjectCreate}
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
		<label class="form-label inline-block text-gray-900 font-bold mb-2">Object Type</label>
		<div class="flex gap-4">
			<div>
				<button on:click={sendEcho}
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
	<div>
		<label class="form-label inline-block text-gray-900 font-bold mb-2">Response from Sockethub</label>
		<div id="messages">
			<ul>
				{#each messages as msg}
					<li>
						<button on:click="{showLog(msg.id)}"
										data-modal-toggle="defaultModal"
										class="hover:bg-blue-400 bg-blue-300 text-black py-0 px-2 rounded mr-3 mb-1">view log</button>
						<span>#{msg.id} {msg.actor.name || msg.actor.id}</span> [<span>{msg.type}</span>]: <span>{msg.object.content}</span>
						{#if msg.error}
							<span class="ml-5 text-red-500">{msg.error}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	</div>
</Module>

<div class="{logModalState ? '' : 'hidden'} bg-slate-800 bg-opacity-50 flex justify-center items-center absolute top-0 right-0 bottom-0 left-0">
	<div style="" class="bg-offwhite px-2 py-2 rounded-md text-left">
		<div class="flex flex-row">
			<div class="text-xs mb-4 text-slate-500 font-mono py-1 basis-1/2">
				<h2>Sent</h2>
				<Highlight language={json} code={jsonSend} />
			</div>
			<div class="text-xs mb-4 text-slate-500 font-mono py-1 basis-1/2">
				<h2>Response</h2>
				<Highlight language={json} code={jsonResp} />
			</div>
		</div>
		<div class="flex flex-col text-center">
			<button on:click="{() => logModalState = false }" class="bg-indigo-500 px-7 py-2 ml-2 rounded-md text-sm text-white font-semibold">Ok</button>
		</div>
	</div>
</div>

<script>
	import Intro from "../../components/Intro.svelte";
	import Module from "../../components/Module.svelte";
	import Highlight from "svelte-highlight";
	import json from "svelte-highlight/languages/json";
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
	let messages = [];
	let content = "";
	let jsonSend = "";
	let jsonResp = "";
	let logModalState = false;
	let selectedLog = 0;
	let log = {};

	function sendActivityObjectCreate() {
		actor = JSON.parse(actorString);
		console.log('creating activity object:  ', actor);
		sc.ActivityStreams.Object.create(actor);
	}

	function showLog(uid) {
		return () => {
			selectedLog = uid;
			logModalState = true;
			jsonSend = JSON.stringify(log[uid].send, undefined, 2);
			jsonResp = JSON.stringify(log[uid].resp, undefined, 2);
		}
	}

	function send(uid, obj) {
		obj.id = "" + uid;
		log[uid] = {};
		log[uid].send = obj;
		console.log('sending: ', obj);
		sc.socket.emit('message', obj, (resp) => {
			console.log('response: ', resp);
			resp.id = "" + uid;
			log[uid].resp = resp
			messages = [resp, ...messages];
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
