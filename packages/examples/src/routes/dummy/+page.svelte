<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import { send } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";
import { writable } from "svelte/store";
import ActivityActor from "../../components/ActivityActor.svelte";
import BaseExample from "../../components/BaseExample.svelte";
import FormField from "../../components/FormField.svelte";
import SockethubButton from "../../components/SockethubButton.svelte";

const actorId = "https://sockethub.org/examples/dummy";

const sockethubState: SockethubStateStore = writable({
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

/**
 * Sends an echo request to Sockethub's dummy platform.
 * Sockethub will respond with the same message content.
 */
async function sendEcho(): Promise<void> {
    send(getASObj("echo"));
}

/**
 * Sends a fail request to Sockethub's dummy platform.
 * Sockethub will respond with an error message for testing error handling.
 */
async function sendFail(): Promise<void> {
    send(getASObj("fail"));
}

/**
 * Sends a throw request to Sockethub's dummy platform.
 * Sockethub will throw an exception for testing exception handling.
 */
async function sendThrow(): Promise<void> {
    send(getASObj("throw"));
}

/**
 * Sends a greet request to Sockethub's dummy platform.
 * Sockethub will respond with a greeting message.
 */
async function sendGreet(): Promise<void> {
    send(getASObj("greet"));
}
</script>

<BaseExample 
    title="Dummy Platform Example"
    description="The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back. You can use either the echo or fail types on your Activity Stream object."
>
    <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg mb-6">
        <h3 class="text-lg font-semibold text-blue-800 mb-2">💡 What You'll Learn</h3>
        <p class="text-blue-700 text-sm mb-3">
            This example demonstrates the core Sockethub workflow with a test platform that doesn't require external connections.
        </p>
        <div class="text-blue-700 text-sm space-y-1">
            <div><strong>📤 Sending:</strong> How to create and send ActivityStreams messages</div>
            <div><strong>📥 Receiving:</strong> How Sockethub responds with results or errors</div>
            <div><strong>🎯 Actor:</strong> How your identity is represented</div>
            <div><strong>🔄 Types:</strong> Different activity types (echo, greet, fail, throw)</div>
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
        
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <h4 class="font-semibold text-yellow-800 mb-2">Try Different Activity Types</h4>
            <p class="text-yellow-700 text-sm mb-3">Each button sends the same basic message structure but with a different <code>type</code> field:</p>
            
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="space-y-2">
                    <div>
                        <SockethubButton buttonAction={sendEcho}>Echo</SockethubButton>
                        <p class="text-yellow-600 text-xs mt-1">Returns your message back unchanged</p>
                    </div>
                    <div>
                        <SockethubButton buttonAction={sendGreet}>Greet</SockethubButton>
                        <p class="text-yellow-600 text-xs mt-1">Returns a friendly greeting</p>
                    </div>
                </div>
                <div class="space-y-2">
                    <div>
                        <SockethubButton buttonAction={sendFail}>Fail</SockethubButton>
                        <p class="text-yellow-600 text-xs mt-1">Returns an error message (for testing error handling)</p>
                    </div>
                    <div>
                        <SockethubButton buttonAction={sendThrow}>Throw</SockethubButton>
                        <p class="text-yellow-600 text-xs mt-1">Throws an exception (for testing exception handling)</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</BaseExample>
