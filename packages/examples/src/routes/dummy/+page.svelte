<Head heading="Dummy Platform Example">
	<title>Dummy Example</title>
	<p>The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back.</p>
	<p>You can use either the echo or fail types on your Activity Stream object.</p>
</Head>

<Module>
	<ConnectStatus status={online} />
	<div class="w-16 md:w-32 lg:w-48 grow w-full">
		<h2 class="py-2">Message Content</h2>
		<input bind:value={content} class="border-4 grow w-full" placeholder="Text to send as content">
	</div>
	<div class="w-16 md:w-32 lg:w-48 w-full">
		<h2 class="py-2">Object Type</h2>
		<div class="flex gap-4">
			<button on:click={sendEcho}
							class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded"
							disabled="{!online}">Echo</button>
			<button on:click={sendFail}
							class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded"
							disabled="{!online}">Fail</button>
		</div>
	</div>
</Module>

<Module>
	<div>
		<h2 class="py-2">Response from Sockethub</h2>
		<div id="messages">
			<ul>
				{#each messages as msg}
					<li>
						<button on:click="{showLog(msg.id)}"
										data-modal-toggle="defaultModal"
										class="hover:bg-blue-400 bg-blue-300 text-black py-0 px-2 rounded mr-3 mb-1">view log</button>
						<span>#{msg.id} {msg.actor.id}</span> [<span>{msg.type}</span>]: <span>{msg.object.content}</span>
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
	import Head from "../../components/Head.svelte";
	import Module from "../../components/Module.svelte";
	import ConnectStatus from "../../components/ConnectStatus.svelte";
	import '@sockethub/client/dist/sockethub-client.js';
	import { io } from 'socket.io-client';
	import Highlight from "svelte-highlight";
	import json from "svelte-highlight/languages/json";

	const activityObject = {
		context: "dummy",
		type: "",
		actor: 'https://sockethub.org/examples/dummyUser',
		object: {
			type: 'message',
			content: ""
		}
	};
	let sc;
	let online = false;
	let counter = 0;
	let messages = [];
	let content = "";
	let jsonSend = "";
	let jsonResp = "";
	let logModalState = false;
	let selectedLog = 0;
	let log = {0:{send:{"hi":"foo"},resp:{"lo":"foo"}}};

	// eslint-disable-next-line no-constant-condition
	if (typeof window) {
		sc = new window.SockethubClient(io('http://localhost:10550', { path: '/sockethub' }));
		sc.socket.on('connect', () => {
			online = true;
		});
		sc.socket.on('error', (e) => {
			console.log('error: ', e);
		})
		sc.socket.on('disconnect', (e) => {
			console.log('disconnect: ', e);
			online = false;
		})
		sc.ActivityStreams.Object.create({
			id: 'https://sockethub.org/examples/dummyUser',
			type: "person",
			name: "Sockethub Examples - Dummy User"
		});
	}

	function showLog(uid) {
		return () => {
			selectedLog = uid;
			logModalState = true;
			jsonSend = JSON.stringify(log[selectedLog].send, undefined, 2);
			jsonResp = JSON.stringify(log[selectedLog].resp, undefined, 2);
		}
	}

	function send(uid, obj) {
		obj.id = "" + uid;
		log[uid] = {};
		log[uid].send = obj;
		sc.socket.emit('message', obj, (resp) => {
			resp.id = "" + uid;
			log[uid].resp = resp;
			console.log(resp);
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
