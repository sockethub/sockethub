<script>
import { base } from "$app/paths";
import Intro from "../components/Intro.svelte";
</script>

<Intro title="Sockethub Examples">
    <title>Sockethub Examples</title>
    
    <div class="space-y-6">
        <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
            <h2 class="text-xl font-semibold text-blue-800 mb-2">What is Sockethub?</h2>
            <p class="text-blue-700 mb-3">
                Sockethub is a <strong>protocol gateway</strong> that bridges web applications with various internet protocols 
                like IRC, XMPP, RSS/ATOM feeds, and more. Instead of implementing each protocol directly in your web app, 
                you send standardized <strong>ActivityStreams</strong> messages to Sockethub, which handles the protocol-specific details.
            </p>
            <p class="text-blue-700">
                Think of it as a universal translator that lets your web application communicate with 
                chat servers, feed readers, and other internet services using a single, consistent API.
            </p>
        </div>

        <div class="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
            <h2 class="text-xl font-semibold text-green-800 mb-2">Key Concepts</h2>
            <div class="space-y-3">
                <div>
                    <h3 class="font-semibold text-green-700">🎭 Actor</h3>
                    <p class="text-green-600 text-sm">Your identity on a platform (e.g., IRC nickname, XMPP username, feed URL)</p>
                </div>
                <div>
                    <h3 class="font-semibold text-green-700">🔧 Platform</h3>
                    <p class="text-green-600 text-sm">A protocol handler (IRC, XMPP, Feeds, etc.) that runs as a separate process</p>
                </div>
                <div>
                    <h3 class="font-semibold text-green-700">📝 ActivityStreams</h3>
                    <p class="text-green-600 text-sm">Standardized JSON format for describing activities like "send message", "connect", "fetch"</p>
                </div>
                <div>
                    <h3 class="font-semibold text-green-700">🔐 Credentials</h3>
                    <p class="text-green-600 text-sm">Connection details securely stored per session (servers, passwords, API keys)</p>
                </div>
            </div>
        </div>

        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <h2 class="text-xl font-semibold text-yellow-800 mb-2">How It Works</h2>
            <ol class="text-yellow-700 space-y-2 text-sm">
                <li><span class="font-semibold">1.</span> Your web app connects to Sockethub via WebSocket</li>
                <li><span class="font-semibold">2.</span> You send ActivityStreams messages describing what you want to do</li>
                <li><span class="font-semibold">3.</span> Sockethub routes messages to the appropriate platform</li>
                <li><span class="font-semibold">4.</span> Platform handles protocol-specific communication</li>
                <li><span class="font-semibold">5.</span> Results are sent back to your web app as ActivityStreams</li>
            </ol>
        </div>

        <div class="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-r-lg">
            <h2 class="text-xl font-semibold text-purple-800 mb-2">Explore the Examples</h2>
            <p class="text-purple-700 mb-3">
                Each example demonstrates a different platform. Start with <strong>Dummy</strong> to understand 
                the basic flow, then explore real-world protocols:
            </p>
            <div class="grid gap-3 text-sm">
                <a href="{base}/dummy" class="block p-3 bg-white rounded border hover:bg-purple-50 transition-colors border-l-4 border-l-green-400">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="font-semibold text-purple-800">🔧 Dummy Platform</div>
                            <div class="text-purple-600">Learn the basics with simple echo/fail examples</div>
                        </div>
                        <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Start Here</span>
                    </div>
                </a>
                <div class="grid md:grid-cols-2 gap-3">
                    <a href="{base}/feeds" class="block p-3 bg-white rounded border hover:bg-purple-50 transition-colors">
                        <div class="font-semibold text-purple-800">📰 RSS/ATOM Feeds</div>
                        <div class="text-purple-600">Fetch and parse web feeds</div>
                    </a>
                    <a href="{base}/metadata" class="block p-3 bg-white rounded border hover:bg-purple-50 transition-colors">
                        <div class="font-semibold text-purple-800">🔍 Metadata</div>
                        <div class="text-purple-600">Extract metadata from web pages</div>
                    </a>
                </div>
                <div class="grid md:grid-cols-2 gap-3">
                    <a href="{base}/irc" class="block p-3 bg-white rounded border hover:bg-purple-50 transition-colors border-l-4 border-l-orange-400">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="font-semibold text-purple-800">💬 IRC Chat</div>
                                <div class="text-purple-600">Connect to IRC servers and channels</div>
                            </div>
                            <span class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Advanced</span>
                        </div>
                    </a>
                    <a href="{base}/xmpp" class="block p-3 bg-white rounded border hover:bg-purple-50 transition-colors border-l-4 border-l-orange-400">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="font-semibold text-purple-800">📨 XMPP Messaging</div>
                                <div class="text-purple-600">Send and receive XMPP messages</div>
                            </div>
                            <span class="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">Advanced</span>
                        </div>
                    </a>
                </div>
            </div>
        </div>

        <div class="text-center text-gray-600 text-sm bg-gray-50 p-4 rounded-lg">
            💡 <strong>Tip:</strong> Watch the connection status at the top and the activity log at the bottom of each example to understand what's happening behind the scenes.
        </div>
    </div>
</Intro>
