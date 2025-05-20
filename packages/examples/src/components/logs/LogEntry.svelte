<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import DummyEntry from "./platforms/DummyEntry.svelte";
import FeedsEntry from "./platforms/FeedsEntry.svelte";
import GenericEntry from "./platforms/GenericEntry.svelte";
interface Props {
    id: string;
    entry: AnyActivityStream;
    buttonAction: () => void;
    response: boolean;
}

let { id, entry, buttonAction, response }: Props = $props();
</script>

<li>
    <button
        onclick={buttonAction}
        data-modal-toggle="defaultModal"
        class="hover:bg-blue-400 bg-blue-300 text-black py-0 px-2 rounded mb-1"
        >view log</button
    >
    <span class="{ response ? 'bg-green-500' : 'bg-orange-300'} rounded-full pl-2 pr-2 mr-1"></span>
    {#if entry.context === "dummy"}
        <DummyEntry {id} {entry} />
    {:else if entry.context === "feeds"}
        <FeedsEntry {id} {entry} />
    {:else}
        <GenericEntry {id} {entry} />
    {/if}
    {#if entry.error}
        <p>
            <span class="ml-5 text-red-500">{entry.error}</span>
        </p>
    {/if}
</li>
