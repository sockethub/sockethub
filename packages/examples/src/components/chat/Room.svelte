<!-- @migration-task Error while migrating Svelte code: can't migrate `let joining = false;` to `$state` because there's a variable named state.
     Rename the variable and try again or migrate by hand. -->
<script lang="ts">
import SockethubButton from "$components/SockethubButton.svelte";
import type { ActorData, AnyActivityStream } from "$lib/sockethub";
import { send } from "$lib/sockethub";
import type { SockethubStateStore } from "$lib/types";

interface Props {
    room: string;
    actor: ActorData;
    context: string;
    sockethubState: SockethubStateStore;
}

let { room = $bindable(), actor, context, sockethubState }: Props = $props();

let joining = $state(false);

async function joinRoom(): Promise<void> {
    joining = true;
    return await send({
        // Platform context - routes to the appropriate chat platform (irc, xmpp)
        context: context,
        // Activity type - "join" means join a chat room/channel
        type: "join",
        // Actor - who is joining (the connected user)
        actor: actor.id,
        // Target - what room/channel to join
        target: {
            id: room,
            name: room,
            type: "room",
        },
    } as AnyActivityStream)
        .catch(() => {
            $sockethubState.joined = false;
            joining = false;
        })
        .then(() => {
            // $actor.roomId = room;
            $sockethubState.joined = true;
            joining = false;
        });
}
</script>

<div class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6 shadow-sm">
    <h4 class="text-lg font-bold text-indigo-900 mb-4 flex items-center">
        <span class="mr-2">🏠</span>
        Join Chat Room
    </h4>
    
    <div class="space-y-4">
        <div class="w-full space-y-2">
            <label for="room" class="block text-sm font-semibold text-gray-700">Room/Channel</label>
            <input 
                id="room" 
                bind:value={room} 
                class="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200 text-gray-900 placeholder-gray-500" 
                placeholder="#general, kosmos-random@kosmos.chat"
            />
            <p class="text-gray-500 text-xs">
                💡 IRC: Use #channel-name | XMPP: Use room@server.com
            </p>
        </div>
        
        <div class="flex justify-end">
            <SockethubButton
                disabled={!$sockethubState.connected || $sockethubState.joined || joining}
                buttonAction={joinRoom}
            >
                {#if joining}
                    <div class="flex items-center space-x-2">
                        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Joining...</span>
                    </div>
                {:else if $sockethubState.joined}
                    <div class="flex items-center space-x-2">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Joined</span>
                    </div>
                {:else}
                    <div class="flex items-center space-x-2">
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span>Join Room</span>
                    </div>
                {/if}
            </SockethubButton>
        </div>
    </div>
</div>
