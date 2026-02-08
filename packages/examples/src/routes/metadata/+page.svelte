<script lang="ts">
import { writable } from "svelte/store";
import { send } from "$lib/sockethub";

const _sockethubState = writable({
    actorSet: false,
});
let url = $state("https://sockethub.org");
let actor = $derived({
    id: url,
    type: "website",
});

function getASObj(type: string) {
    return {
        // Platform context - routes to Sockethub's metadata platform
        context: "metadata",
        // Activity type - "fetch" tells the platform to extract metadata
        type: type,
        // Actor - the website URL to analyze (represented as a "website" actor)
        actor: actor,
    };
}

async function _sendFetch(): Promise<void> {
    send(getASObj("fetch"));
}
</script>

<BaseExample 
    title="Metadata Platform Example"
    description="Sockethub's metadata platform takes a URL, fetches and parses it for any metadata."
>
    <div class="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-r-lg mb-6">
        <h3 class="text-lg font-semibold text-purple-800 mb-2">🔍 How Metadata Extraction Works</h3>
        <p class="text-purple-700 text-sm mb-3">
            This example shows how Sockethub can extract structured metadata from any web page.
        </p>
        <div class="text-purple-700 text-sm space-y-1">
            <div><strong>🌐 Fetching:</strong> Sockethub downloads the web page content</div>
            <div><strong>🔍 Scanning:</strong> Searches for Open Graph, Twitter Cards, JSON-LD, and meta tags</div>
            <div><strong>📊 Extracting:</strong> Pulls out titles, descriptions, images, and other metadata</div>
            <div><strong>📋 Returning:</strong> Provides structured data about the page</div>
        </div>
    </div>
    <div class="space-y-4">
        <FormField label="Website URL" id="URL" bind:value={url} placeholder="https://example.com" />
        <p class="text-gray-600 text-sm">
            ⬆️ Try different websites: news articles, social media posts, product pages, etc.
        </p>

        <ActivityActor {actor} {sockethubState} />
        
        <div class="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p class="text-blue-700 text-sm">
                <strong>💡 What happens when you click Fetch:</strong><br>
                The website URL becomes the "actor", and Sockethub sends a "fetch" activity to download the page and extract all available metadata like page titles, descriptions, and social media preview data.
            </p>
        </div>

        <div class="w-full text-right">
            <SockethubButton buttonAction={sendFetch}>Extract Metadata</SockethubButton>
        </div>
    </div>
</BaseExample>
