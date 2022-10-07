<h1>Dummy Example</h1>
<div class="px-4 py-2">
<p>The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back.</p>
<p>You can use either the echo or fail types on your Activity Stream object.</p>
</div>
<div class="py-4">
	<h2 class="py-2">Message Content</h2>
	<input class="border-4" placeholder="Text to send as content">
	<h2 class="py-2">Send Object Type</h2>
	<button class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded">Echo</button>
	<button class="hover:bg-blue-700 bg-blue-500 text-white font-bold py-2 px-4 rounded">Fail</button>
</div>
<div class="py-4">
	<h2 class="py-2">Response from Sockethub</h2>
	<div id="messages"></div>
</div>
