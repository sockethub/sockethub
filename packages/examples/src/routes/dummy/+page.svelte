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
    <div>
        <FormField 
            label="Message Content" 
            id="objectContent" 
            bind:value={content}
            placeholder="Hello from Sockethub"
        />
        <div class="w-full p-2">
            <label for="sendEcho" class="inline-block text-gray-900 font-bold w-32">Object Type</label>
            <div class="flex gap-4">
                <div id="sendEcho">
                    <SockethubButton buttonAction={sendEcho}
                        >Echo</SockethubButton
                    >
                    <SockethubButton buttonAction={sendGreet}
                        >Greet</SockethubButton
                    >
                    <SockethubButton buttonAction={sendFail}
                        >Fail</SockethubButton
                    >
                    <SockethubButton buttonAction={sendThrow}
                        >Throw</SockethubButton
                    >
                </div>
            </div>
        </div>
    </div>
</BaseExample>
