<h1>Dummy Example</h1>
<div class="px-4 py-2">
<p>The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back.</p>
<p>You can use either the echo or fail types on your Activity Stream object.</p>
</div>
<div class="py-4">
	<h2 class="py-2">Message Content</h2>
	<input class="border-4" placeholder="Text to send as content">
	<h2 class="py-2">Send Object Type</h2>
	<button on:click={sendEcho} class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded">Echo</button>
	<button on:click={sendFail} class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded">Fail</button>
</div>
<div class="py-4">
	<h2 class="py-2">Response from Sockethub</h2>
	<div id="messages"></div>
</div>

<script>
	import SockethubClient from '@sockethub/client';
	import { io } from 'socket.io-client';

	const sc = new SockethubClient(io('http://localhost:10550', { path: '/sockethub' }));
	sc.ActivityStreams.Object.create({
		id: 'https://sockethub.org/examples/dummyUser',
		type: "person",
		name: "Sockethub Examples - Dummy User"
	});
	const activityObject = {
		context: "dummy",
		type: "",
		actor: 'https://sockethub.org/examples/dummyUser',
		object: {
			type: 'message',
			content: ""
		}
	}
	function sendEcho() {
		activityObject.type = "echo";
		activityObject.content.content = ""; // get value of message input
		sc.emit('message', activityObject, (resp) => {
			// display result
		});
	}

	function sendFail() {}
</script>
