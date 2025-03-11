<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import Intro from "$components/Intro.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import Logger from "$components/logs/Logger.svelte";
import { send } from "$lib/sockethub";
import { writable } from "svelte/store";

const actorId = "https://sockethub.org/examples/feedsUser";
const sockethubState = writable({
    actorSet: false,
});
let actor = $derived({
    id: actorId,
    type: "person",
    name: "Sockethub Examples Feeds",
});

let url = $state("https://sockethub.org/feed.xml");

function getASObj(type: string) {
    return {
        context: "feeds",
        type: type,
        actor: actorId,
        target: {
            type: "feed",
            id: url,
        },
    };
}

async function sendFetch(): Promise<void> {
    send(getASObj("fetch"));
}
</script>

<Intro title="Feeds Platform Example">
    <title>Feeds Example</title>
    <p>
        The feeds platform takes an RSS/ATOM feed URL, fetches and parses it, and returns an array
        of Activity Objects for each entry.
    </p>
</Intro>

<ActivityActor {actor} {sockethubState} />

<div>
    <div class="w-full p-2">
        <label for="URL" class="inline-block text-gray-900 font-bold w-32">Feed URL</label>
        <input id="URL" bind:value={url} class="border-4" />
    </div>
    <div class="w-full text-right">
        <SockethubButton disabled={!$sockethubState.actorSet} buttonAction={sendFetch}>Fetch</SockethubButton
        >
    </div>
</div>

<Logger />
