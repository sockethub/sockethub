<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { actorAsObject, contextFor, send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import { writable } from "svelte/store";

const sockethubState = writable({
    actorSet: false,
});

let url = $state("https://sockethub.org");

const actor = $derived({
    id: url,
    type: "website",
    name: url,
});

async function sendFetch(): Promise<void> {
    await send({
        "@context": await contextFor("metadata"),
        type: "fetch",
        actor: actorAsObject(actor),
    } as AnyActivityStream);
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
            The page URL is the actor <code>id</code> with <code>type: "website"</code>.
        </p>

        <ActivityActor {actor} {sockethubState} />

        <div class="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p class="text-blue-700 text-sm">
                <strong>💡 What happens when you click Fetch:</strong><br>
                Sockethub sends a <code>fetch</code> activity with the page URL as the actor and returns extracted metadata.
            </p>
        </div>

        <div class="w-full text-right">
            <SockethubButton
                buttonAction={sendFetch}
                disabled={!$sockethubState.actorSet}
            >
                Extract Metadata
            </SockethubButton>
        </div>
    </div>
</BaseExample>
