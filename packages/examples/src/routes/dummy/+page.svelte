<script lang="ts">
import { writable } from "svelte/store";
import type { AnyActivityStream } from "$lib/sockethub";
import { send } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

const actorId = "https://sockethub.org/examples/dummy";

const _sockethubState: SockethubStateStore = writable({
    actorSet: false,
});

let content = $state("");

/**
 * Creates an ActivityStreams object for Sockethub's dummy platform.
 * Sockethub's dummy platform is used for testing basic functionality.
 *
 * @param type - The activity type (echo, fail, throw, greet)
 * @returns ActivityStreams object ready to send to Sockethub's dummy platform
 */
function getASObj(type: string): AnyActivityStream {
    return {
        // Platform context - tells Sockethub which platform to route this to
        context: "dummy",
        // Activity type - what action to perform (echo, fail, throw, greet)
        type: type,
        // Actor - who is performing the action
        actor: {
            type: "person",
            id: actorId,
        },
        // Object - what the action is performed on
        object: {
            type: "message",
            content: content,
        },
    };
}

function _sendType(type: string): void {
    send(getASObj(type));
}

/**
 * Sends an echo request to Sockethub's dummy platform.
 * Sockethub will respond with the same message content.
 */
async function _sendEcho(): Promise<void> {
    send(getASObj("echo"));
}

/**
 * Sends a fail request to Sockethub's dummy platform.
 * Sockethub will respond with an error message for testing error handling.
 */
async function _sendFail(): Promise<void> {
    send(getASObj("fail"));
}

/**
 * Sends a throw request to Sockethub's dummy platform.
 * Sockethub will throw an exception for testing exception handling.
 */
async function _sendThrow(): Promise<void> {
    send(getASObj("throw"));
}

/**
 * Sends a greet request to Sockethub's dummy platform.
 * Sockethub will respond with a greeting message.
 */
async function _sendGreet(): Promise<void> {
    send(getASObj("greet"));
}
</script>

<BaseExample 
    title="Dummy Platform Example"
    description="The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back. You can use either the echo or fail types on your Activity Stream object."
>
    <div class="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm">
        <h3 class="text-xl font-bold text-blue-900 mb-3 flex items-center">
            <span class="mr-2">💡</span>
            What You'll Learn
        </h3>
        <p class="text-blue-800 mb-4 leading-relaxed">
            This example demonstrates the core Sockethub workflow with a test platform that doesn't require external connections.
        </p>
        <div class="grid md:grid-cols-2 gap-3 text-blue-800">
            <div class="flex items-start space-x-2">
                <span class="text-lg">📤</span>
                <div>
                    <div class="font-semibold">Sending</div>
                    <div class="text-sm text-blue-700">How to create and send ActivityStreams messages</div>
                </div>
            </div>
            <div class="flex items-start space-x-2">
                <span class="text-lg">📥</span>
                <div>
                    <div class="font-semibold">Receiving</div>
                    <div class="text-sm text-blue-700">How Sockethub responds with results or errors</div>
                </div>
            </div>
            <div class="flex items-start space-x-2">
                <span class="text-lg">🎯</span>
                <div>
                    <div class="font-semibold">Actor</div>
                    <div class="text-sm text-blue-700">How your identity is represented</div>
                </div>
            </div>
            <div class="flex items-start space-x-2">
                <span class="text-lg">🔄</span>
                <div>
                    <div class="font-semibold">Types</div>
                    <div class="text-sm text-blue-700">
                        Different activity types (echo, greet, fail, throw, exit0, exit1, sigterm, sigkill, throwTypeError, throwReferenceError, hang)
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="space-y-4">
        <FormField 
            label="Message Content" 
            id="objectContent" 
            bind:value={content}
            placeholder="Hello from Sockethub"
        />
        <p class="text-gray-600 text-sm">
            ⬆️ This text will be included in the <code>object.content</code> field of your ActivityStreams message.
        </p>
        
        <div class="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6 shadow-sm">
            <h4 class="text-lg font-bold text-amber-900 mb-3 flex items-center">
                <span class="mr-2">🚀</span>
                Try Different Activity Types
            </h4>
            <p class="text-amber-800 mb-4 leading-relaxed">
                Each button sends the same basic message structure but with a different <code class="bg-amber-100 px-1 rounded text-sm">type</code> field:
            </p>
            
            <div class="grid md:grid-cols-2 gap-4">
                <div class="space-y-4">
                    <div class="bg-white rounded-lg p-4 border border-amber-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-amber-900 mb-1">Echo</div>
                                <p class="text-amber-700 text-sm">Returns your message back unchanged</p>
                            </div>
                            <SockethubButton buttonAction={sendEcho}>Echo</SockethubButton>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-amber-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-amber-900 mb-1">Greet</div>
                                <p class="text-amber-700 text-sm">Returns a friendly greeting</p>
                            </div>
                            <SockethubButton buttonAction={sendGreet}>Greet</SockethubButton>
                        </div>
                    </div>
                </div>
                <div class="space-y-4">
                    <div class="bg-white rounded-lg p-4 border border-amber-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-amber-900 mb-1">Fail</div>
                                <p class="text-amber-700 text-sm">Returns an error message (for testing error handling)</p>
                            </div>
                            <SockethubButton buttonAction={sendFail}>Fail</SockethubButton>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-amber-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-amber-900 mb-1">Throw</div>
                                <p class="text-amber-700 text-sm">Throws an exception (for testing exception handling)</p>
                            </div>
                            <SockethubButton buttonAction={sendThrow}>Throw</SockethubButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="bg-gradient-to-r from-red-50 to-rose-50 border border-red-200 rounded-xl p-6 shadow-sm">
            <h4 class="text-lg font-bold text-red-900 mb-3 flex items-center">
                <span class="mr-2">⚠️</span>
                Crash/Recovery Tests
            </h4>
            <p class="text-red-800 mb-4 leading-relaxed">
                These types intentionally terminate or hang the dummy platform process. Use them to validate crash handling and recovery.
            </p>

            <div class="grid md:grid-cols-2 gap-4">
                <div class="space-y-4">
                    <div class="bg-white rounded-lg p-4 border border-red-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-red-900 mb-1">Exit 0</div>
                                <p class="text-red-700 text-sm">Graceful exit (process.exit(0))</p>
                            </div>
                            <SockethubButton buttonAction={() => sendType("exit0")}>
                                Exit 0
                            </SockethubButton>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-red-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-red-900 mb-1">Exit 1</div>
                                <p class="text-red-700 text-sm">Crash exit (process.exit(1))</p>
                            </div>
                            <SockethubButton buttonAction={() => sendType("exit1")}>
                                Exit 1
                            </SockethubButton>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-red-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-red-900 mb-1">SIGTERM</div>
                                <p class="text-red-700 text-sm">Self-terminate with SIGTERM</p>
                            </div>
                            <SockethubButton buttonAction={() => sendType("sigterm")}>
                                SIGTERM
                            </SockethubButton>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-red-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-red-900 mb-1">SIGKILL</div>
                                <p class="text-red-700 text-sm">Self-terminate with SIGKILL</p>
                            </div>
                            <SockethubButton buttonAction={() => sendType("sigkill")}>
                                SIGKILL
                            </SockethubButton>
                        </div>
                    </div>
                </div>
                <div class="space-y-4">
                    <div class="bg-white rounded-lg p-4 border border-red-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-red-900 mb-1">TypeError</div>
                                <p class="text-red-700 text-sm">Throw a TypeError on next tick</p>
                            </div>
                            <SockethubButton
                                buttonAction={() => sendType("throwTypeError")}
                            >
                                TypeError
                            </SockethubButton>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-red-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-red-900 mb-1">ReferenceError</div>
                                <p class="text-red-700 text-sm">Throw a ReferenceError on next tick</p>
                            </div>
                            <SockethubButton
                                buttonAction={() => sendType("throwReferenceError")}
                            >
                                ReferenceError
                            </SockethubButton>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg p-4 border border-red-200">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="font-semibold text-red-900 mb-1">Hang</div>
                                <p class="text-red-700 text-sm">Block the event loop (heartbeat timeout)</p>
                            </div>
                            <SockethubButton buttonAction={() => sendType("hang")}>
                                Hang
                            </SockethubButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</BaseExample>
