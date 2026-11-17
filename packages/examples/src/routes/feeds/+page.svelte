<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import Step from "$components/Step.svelte";
import { actorAsObject, contextFor, send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import { writable } from "svelte/store";

const sockethubState = writable({
    actorSet: false,
});

let url = $state("https://sockethub.org/feed.xml");
let fetchError = $state<string | null>(null);

const actor = $derived({
    id: url,
    type: "feed",
    name: url,
});

async function sendFetch(): Promise<void> {
    fetchError = null;
    try {
        await send({
            "@context": await contextFor("feeds"),
            type: "fetch",
            actor: actorAsObject(actor),
        } as AnyActivityStream);
    } catch (err) {
        fetchError = err instanceof Error ? err.message : String(err);
    }
}
</script>

<BaseExample
    platform="feeds"
    title="Feeds Platform Example"
    description="Give Sockethub the address of an RSS or Atom feed. It downloads and parses the feed, and sends back one activity per entry."
>
    <Step n={1} title="Choose a feed" done={$sockethubState.actorSet}>
        <FormField
            label="Feed URL"
            id="URL"
            type="url"
            bind:value={url}
            placeholder="https://example.com/feed.xml"
            hint="For feeds, the URL is the actor: Sockethub fetches on behalf of the feed itself."
        />
    </Step>

    <Step n={2} title="Confirm the actor" description='The actor goes on every activity. Here its id is the feed URL and its type is "feed".' done={$sockethubState.actorSet}>
        <ActivityActor {actor} {sockethubState} />
    </Step>

    <Step
        n={3}
        title="Fetch the feed"
        description="Sends a fetch activity. Each entry comes back as its own message in the activity log."
        locked={!$sockethubState.actorSet}
    >
        {#if fetchError}
            <div class="callout callout-error" role="alert">
                <p><strong class="font-semibold">Fetch failed.</strong> <span class="font-mono text-xs">{fetchError}</span></p>
            </div>
        {/if}
        <div class="flex justify-end">
            <SockethubButton buttonAction={sendFetch} disabled={!$sockethubState.actorSet}>Fetch Feed</SockethubButton>
        </div>
    </Step>
</BaseExample>
