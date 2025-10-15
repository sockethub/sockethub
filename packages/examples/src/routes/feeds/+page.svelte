<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
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

/**
 * Creates an ActivityStreams object for the feeds platform.
 * This is sent to Sockethub, which handles the actual RSS/ATOM feed processing.
 *
 * @param type - The activity type (typically "fetch" for feeds)
 * @returns ActivityStreams object that tells Sockethub which feed to process
 */
function getASObj(type: string) {
    return {
        // Platform context - routes to Sockethub's feeds platform
        context: "feeds",
        // Activity type - "fetch" tells the platform to download and parse the feed
        type: type,
        // Actor - the feed URL to fetch (represented as a "website" actor)
        actor: actor,
    };
}

/**
 * Sends a fetch request to Sockethub's feeds platform.
 *
 * This example app sends the request, then Sockethub will:
 * 1. Download the feed content from the URL
 * 2. Parse the RSS/ATOM format
 * 3. Convert entries to ActivityStreams objects
 * 4. Send the results back to this client for display
 */
async function sendFetch(): Promise<void> {
    send(getASObj("fetch"));
}
</script>

<BaseExample 
    title="Feeds Platform Example"
    description="The feeds platform takes an RSS/ATOM feed URL, fetches and parses it, and returns an array of Activity Objects for each entry."
>
    <FormField label="Feed URL" id="URL" bind:value={url} placeholder="https://example.com/feed.xml" />

    <ActivityActor {actor} {sockethubState} />

    <div>
        <div class="w-full text-right">
            <SockethubButton buttonAction={sendFetch}>Fetch</SockethubButton>
        </div>
    </div>
</BaseExample>
