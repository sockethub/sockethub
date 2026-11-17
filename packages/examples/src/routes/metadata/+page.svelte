<script lang="ts">
import ActivityActor from "$components/ActivityActor.svelte";
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import MetadataPreview, {
    isPageObject,
    type PageObject,
} from "$components/MetadataPreview.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import Step from "$components/Step.svelte";
import { actorAsObject, contextFor, send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";
import { writable } from "svelte/store";

const sockethubState = writable({
    actorSet: false,
});

let url = $state("https://sockethub.org");
let preview: PageObject | undefined = $state();
let previewError = $state("");

const actor = $derived({
    id: url,
    type: "website",
    name: url,
});

async function sendFetch(): Promise<void> {
    preview = undefined;
    previewError = "";
    try {
        const resp = await send({
            "@context": await contextFor("metadata"),
            type: "fetch",
            actor: actorAsObject(actor),
        } as AnyActivityStream);
        if (isPageObject(resp.object)) {
            preview = resp.object;
        }
    } catch (err) {
        previewError = err instanceof Error ? err.message : String(err);
        throw err;
    }
}
</script>

<BaseExample
    platform="metadata"
    title="Metadata Platform Example"
    description="Give Sockethub a web page address. It reads the page's Open Graph, Twitter Card, and meta tags, and returns what a chat app needs for a link preview."
>
    <Step n={1} title="Choose a page and confirm the actor" description='Every activity names an actor. Here the actor is the page: its id is the URL and its type is "website".' done={$sockethubState.actorSet}>
        <FormField
            label="Website URL"
            id="URL"
            type="url"
            bind:value={url}
            placeholder="https://example.com"
        />
        <ActivityActor {actor} {sockethubState} />
    </Step>

    <Step
        n={2}
        title="Extract the metadata"
        description="Sends a fetch activity and renders the reply as a link preview."
        blockedHint={$sockethubState.actorSet ? undefined : "Confirm the actor first."}
    >
        <div class="flex justify-end">
            <SockethubButton buttonAction={sendFetch} disabled={!$sockethubState.actorSet}>Extract metadata</SockethubButton>
        </div>
        {#if preview}
            <div class="space-y-2">
                <p class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Preview</p>
                <MetadataPreview page={preview} />
                <p class="hint">How a chat client might show this link. The raw reply is in the activity log.</p>
            </div>
        {:else if previewError}
            <div class="callout callout-error" role="alert">{previewError}</div>
        {/if}
    </Step>
</BaseExample>
