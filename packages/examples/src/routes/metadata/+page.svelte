<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import Intro from "$components/Intro.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import Logger, { addObject } from "$components/logs/Logger.svelte";
import { send } from "$lib/sockethub";
import { writable } from "svelte/store";

const sockethubState = writable({
    actorSet: false,
});
let url = $state("https://sockethub.org");
let actor = $derived({
    id: url,
    type: "website",
});

function getASObj(type: string) {
    return {
        context: "metadata",
        type: type,
        actor: actor,
    };
}

async function sendFetch(): Promise<void> {
    send(getASObj("fetch"));
}
</script>

<Intro title="Feeds Platform Example">
    <title>Metadata Example</title>
    <p>
        The metadata platform takes a URL, fetches and parses it for any metadata.
    </p>
</Intro>

<ActivityActor {actor} {sockethubState} />

<div>
    <div class="w-full p-2">
        <label for="URL" class="inline-block text-gray-900 font-bold w-32">Feed URL</label>
        <input id="URL" bind:value={url} class="border-4" />
    </div>
    <div class="w-full text-right">
        <SockethubButton buttonAction={sendFetch}>Fetch</SockethubButton
        >
    </div>
</div>

<Logger />
