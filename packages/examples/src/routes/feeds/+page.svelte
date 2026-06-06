<script lang="ts">
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { actorAsObject, contextFor, send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";

let url = $state("https://sockethub.org/feed.xml");

const actor = $derived({
    id: url,
    type: "feed",
    name: url,
});

async function sendFetch(): Promise<void> {
    await send({
        "@context": await contextFor("feeds"),
        type: "fetch",
        actor: actorAsObject(actor),
    } as AnyActivityStream);
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
            The feed URL is the actor <code>id</code> with <code>type: "feed"</code>.
        </p>

        <div class="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p class="text-blue-700 text-sm">
                <strong>💡 What happens when you click Fetch:</strong><br>
                Sockethub sends a <code>fetch</code> activity with the feed URL as the actor and returns a collection of entries.
            </p>
        </div>

        <div class="w-full text-right">
            <SockethubButton buttonAction={sendFetch}>Fetch Feed</SockethubButton>
        </div>
    </div>
</BaseExample>
