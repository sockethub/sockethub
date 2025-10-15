<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import { send } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";
import { writable } from "svelte/store";
import ActivityActor from "../../components/ActivityActor.svelte";
import BaseExample from "../../components/BaseExample.svelte";
import SockethubButton from "../../components/SockethubButton.svelte";

const actorId = "https://sockethub.org/examples/dummy";

const sockethubState: SockethubStateStore = writable({
    actorSet: false,
});

let content = $state("");

function getASObj(type: string): AnyActivityStream {
    return {
        context: "dummy",
        type: type,
        actor: {
            type: "person",
            id: actorId,
        },
        object: {
            type: "message",
            content: content,
        },
    };
}

async function sendEcho(): Promise<void> {
    send(getASObj("echo"));
}

async function sendFail(): Promise<void> {
    send(getASObj("fail"));
}

async function sendThrow(): Promise<void> {
    send(getASObj("throw"));
}
async function sendGreet(): Promise<void> {
    send(getASObj("greet"));
}
</script>

<BaseExample 
    title="Dummy Platform Example"
    description="The dummy platform is the most basic test to communicate via Sockethub to a platform, and receive a response back. You can use either the echo or fail types on your Activity Stream object."
>
    <div>
        <div class="w-full p-2">
            <label for="objectContent" class="inline-block text-gray-900 font-bold w-32"
                >Message Content</label
            >
            <input
                id="objectContent"
                bind:value={content}
                class="border-4"
                placeholder="Text to send as content"
            />
        </div>
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
