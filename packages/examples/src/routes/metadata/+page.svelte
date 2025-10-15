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

async function sendFetch(): Promise<void> {
    send(getASObj("fetch"));
}
</script>

<BaseExample 
    title="Metadata Platform Example"
    description="Sockethub's metadata platform takes a URL, fetches and parses it for any metadata."
>
    <FormField label="Website URL" id="URL" bind:value={url} placeholder="https://example.com" />

    <ActivityActor {actor} {sockethubState} />

    <div class="w-full text-right">
        <SockethubButton buttonAction={sendFetch}>Fetch</SockethubButton>
    </div>
</BaseExample>
