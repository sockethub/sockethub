<script lang="ts">
import { writable } from "svelte/store";
import { send } from "$lib/sockethub";

const _sockethubState = writable({
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
async function _sendFetch(): Promise<void> {
    send(getASObj("fetch"));
}
</script>

<BaseExample 
    title="Feeds Platform Example"
    description="The feeds platform takes an RSS/ATOM feed URL, fetches and parses it, and returns an array of Activity Objects for each entry."
>
    <div class="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg mb-6">
        <h3 class="text-lg font-semibold text-green-800 mb-2">📰 How Feed Processing Works</h3>
        <p class="text-green-700 text-sm mb-3">
            This example shows how Sockethub can fetch and parse RSS/ATOM feeds from any website.
        </p>
        <div class="text-green-700 text-sm space-y-1">
            <div><strong>🌐 Fetching:</strong> Sockethub downloads the feed content from the URL</div>
            <div><strong>🔍 Parsing:</strong> Content is parsed from RSS/ATOM format</div>
            <div><strong>📝 Converting:</strong> Each feed entry becomes an ActivityStreams object</div>
            <div><strong>📊 Results:</strong> You receive an array of structured feed entries</div>
        </div>
    </div>
    <div class="space-y-4">
        <FormField label="Feed URL" id="URL" bind:value={url} placeholder="https://example.com/feed.xml" />
        <p class="text-gray-600 text-sm">
            ⬆️ Try different RSS/ATOM feeds: news sites, blogs, podcasts, etc.
        </p>

        <ActivityActor {actor} {sockethubState} />
        
        <div class="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p class="text-blue-700 text-sm">
                <strong>💡 What happens when you click Fetch:</strong><br>
                The feed URL becomes the "actor" (like a website identity), and Sockethub sends a "fetch" activity to download and parse the feed content.
            </p>
        </div>

        <div class="w-full text-right">
            <SockethubButton buttonAction={sendFetch}>Fetch Feed</SockethubButton>
        </div>
    </div>
</BaseExample>
