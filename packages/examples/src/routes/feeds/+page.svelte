<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import BaseExample from "$components/BaseExample.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { send } from "$lib/sockethub";
import { writable } from "svelte/store";

const sockethubState = writable({
    actorSet: false,
});

let url = $state("https://sockethub.org/feed.xml");

const actor = $derived({
    type: "website",
    id: url,
});

function getASObj(type: string) {
    return {
        context: "feeds",
        type: type,
        actor: actor,
    };
}

async function sendFetch(): Promise<void> {
    send(getASObj("fetch"));
}
</script>

<BaseExample 
    title="Feeds Platform Example"
    description="The feeds platform takes an RSS/ATOM feed URL, fetches and parses it, and returns an array of Activity Objects for each entry."
>
    <div>
        <div class="w-full p-2">
            <label for="URL" class="inline-block text-gray-900 font-bold w-32">Feed URL</label>
            <input id="URL" bind:value={url} class="border-4" />
        </div>
    </div>

    <ActivityActor {actor} {sockethubState} />

    <div>
        <div class="w-full text-right">
            <SockethubButton buttonAction={sendFetch}>Fetch</SockethubButton>
        </div>
    </div>
</BaseExample>
