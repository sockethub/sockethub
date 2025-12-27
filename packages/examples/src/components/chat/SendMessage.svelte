<!-- @migration-task Error while migrating Svelte code: can't migrate `let message = "";` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import SockethubButton from "$components/SockethubButton.svelte";
import type { ActorData } from "$lib/sockethub";
import { send } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

interface Props {
    actor: ActorData;
    context: string;
    sockethubState: SockethubStateStore;
    room: string;
}

let { actor, context, sockethubState, room }: Props = $props();

let message = $state("");
let sending = $state(false);

async function sendMessage() {
    if (!message.trim()) return;

    sending = true;
    const messageToSend = message.trim();
    console.log("send message: ", messageToSend);

    try {
        await send({
            context: context,
            type: "send",
            actor: actor.id,
            object: {
                type: "message",
                content: messageToSend,
            },
            target: {
                id: room,
                name: room,
                type: "room",
            },
        });
        // Clear the message input after successful send
        message = "";
    } catch (error) {
        console.error("Failed to send message:", error);
    } finally {
        sending = false;
    }
}
</script>

<div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm">
    <h4 class="text-lg font-bold text-green-900 mb-4 flex items-center">
        <span class="mr-2">💬</span>
        Send Message
    </h4>
    
    <div class="space-y-4">
        <div class="w-full space-y-2">
            <label for="sendMessage" class="block text-sm font-semibold text-gray-700">Your Message</label>
            <div class="flex space-x-3">
                <input 
                    id="sendMessage" 
                    bind:value={message} 
                    class="flex-1 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 text-gray-900 placeholder-gray-500" 
                    placeholder="Type your message here..."
                    on:keydown={(e) => {
                        if (e.key === 'Enter' && !sending && $sockethubState.connected) {
                            sendMessage();
                        }
                    }}
                />
                <SockethubButton 
                    disabled={!$sockethubState.connected || sending || !message.trim()} 
                    buttonAction={sendMessage}
                >
                    {#if sending}
                        <div class="flex items-center space-x-2">
                            <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span class="hidden sm:inline">Sending...</span>
                        </div>
                    {:else}
                        <div class="flex items-center space-x-2">
                            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                            <span class="hidden sm:inline">Send</span>
                        </div>
                    {/if}
                </SockethubButton>
            </div>
            <p class="text-gray-500 text-xs">
                💡 Press Enter to send quickly
            </p>
        </div>
    </div>
</div>
