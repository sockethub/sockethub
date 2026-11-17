<script lang="ts">
import type { AnyActivityStream } from "$lib/sockethub";
import { contextFor, send } from "$lib/sockethub";
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import Step from "$components/Step.svelte";
import Highlight from "svelte-highlight";
import json from "svelte-highlight/languages/json";

const actorId = "https://sockethub.org/examples/dummy";

let content = $state("Hello from Sockethub");

/**
 * Creates an ActivityStreams object for Sockethub's dummy platform.
 * Sockethub's dummy platform is used for testing basic functionality.
 *
 * @param type - The activity type (echo, fail, throw, greet)
 * @returns ActivityStreams object ready to send to Sockethub's dummy platform
 */
async function getASObj(type: string): Promise<AnyActivityStream> {
    return {
        "@context": await contextFor("dummy"),
        // Activity type - what action to perform (echo, fail, throw, greet)
        type: type,
        // Actor - who is performing the action
        actor: {
            type: "person",
            id: actorId,
            name: actorId,
        },
        // Object - what the action is performed on
        object: {
            type: "message",
            content: content,
        },
    };
}

async function sendType(type: string): Promise<void> {
    await send(await getASObj(type));
}

/**
 * Sends an echo request to Sockethub's dummy platform.
 * Sockethub will respond with the same message content.
 */
async function sendEcho(): Promise<void> {
    await send(await getASObj("echo"));
}

async function sendFail(): Promise<void> {
    await send(await getASObj("fail"));
}

async function sendThrow(): Promise<void> {
    await send(await getASObj("throw"));
}

async function sendGreet(): Promise<void> {
    await send(await getASObj("greet"));
}

const basicTypes = [
    {
        type: "echo",
        label: "Echo",
        text: "Sends your message straight back.",
        action: sendEcho,
    },
    {
        type: "greet",
        label: "Greet",
        text: "Replies with a greeting.",
        action: sendGreet,
    },
    {
        type: "fail",
        label: "Fail",
        text: "Returns an error, so you can see how failures look.",
        action: sendFail,
    },
    {
        type: "throw",
        label: "Throw",
        text: "Throws inside the platform. Sockethub reports it as an error.",
        action: sendThrow,
    },
];

const crashTypes = [
    {
        type: "exit0",
        label: "Exit 0",
        text: "Exits cleanly with process.exit(0).",
    },
    { type: "exit1", label: "Exit 1", text: "Crashes with process.exit(1)." },
    {
        type: "sigterm",
        label: "SIGTERM",
        text: "Terminates itself with SIGTERM.",
    },
    { type: "sigkill", label: "SIGKILL", text: "Kills itself with SIGKILL." },
    {
        type: "throwTypeError",
        label: "TypeError",
        text: "Throws a TypeError on the next tick.",
    },
    {
        type: "throwReferenceError",
        label: "ReferenceError",
        text: "Throws a ReferenceError on the next tick.",
    },
    {
        type: "hang",
        label: "Hang",
        text: "Blocks the event loop until the heartbeat times out.",
    },
];

const preview = $derived(`{
  "@context": ["…/activitystreams", "…/dummy"],
  "type": "echo",
  "actor": { "type": "person", "id": "${actorId}" },
  "object": { "type": "message", "content": ${JSON.stringify(content)} }
}`);
</script>

<BaseExample
    platform="dummy"
    title="Dummy Platform Example"
    description="The dummy platform answers instantly and talks to nothing outside Sockethub. Use it to see what a request and its response look like before you try a real protocol."
>
    <Step n={1} title="Write a message" description="This text goes into the object.content field of the activity.">
        <FormField
            label="Message Content"
            id="objectContent"
            bind:value={content}
            placeholder="Hello from Sockethub"
        />
    </Step>

    <Step n={2} title="Send it with an activity type" description="Each button sends the same message with a different type. Watch the reply arrive in the activity log.">
        <ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
            {#each basicTypes as item (item.type)}
                <li class="flex items-center justify-between gap-4 px-4 py-3">
                    <div class="min-w-0">
                        <code class="tok">{item.type}</code>
                        <p class="mt-1 text-sm text-zinc-500">{item.text}</p>
                    </div>
                    <SockethubButton variant={item.type === "echo" ? "primary" : "secondary"} buttonAction={item.action}>{item.label}</SockethubButton>
                </li>
            {/each}
        </ul>
    </Step>

    <section class="card overflow-hidden">
        <div class="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 sm:px-6">
            <h2 class="text-sm font-semibold text-zinc-900">The message these buttons send</h2>
            <span class="hidden text-xs text-zinc-500 sm:inline">type changes per button</span>
        </div>
        <div class="code-block text-[12.5px]">
            <Highlight language={json} code={preview} />
        </div>
    </section>

    <details class="card group overflow-hidden">
        <summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-4 select-none sm:px-6 [&::-webkit-details-marker]:hidden">
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
            </span>
            <span class="min-w-0 flex-1">
                <span class="block text-base font-semibold text-zinc-900">Crash and recovery tests</span>
                <span class="block text-sm text-zinc-500">For Sockethub developers. These kill or hang the dummy platform process.</span>
            </span>
            <svg class="size-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </summary>
        <ul class="mx-4 mb-4 divide-y divide-zinc-100 rounded-lg border border-zinc-200 sm:mx-6 sm:mb-6">
            {#each crashTypes as item (item.type)}
                <li class="flex items-center justify-between gap-4 px-4 py-3">
                    <div class="min-w-0">
                        <code class="tok">{item.type}</code>
                        <p class="mt-1 text-sm text-zinc-500">{item.text}</p>
                    </div>
                    <SockethubButton variant="danger" buttonAction={() => sendType(item.type)}>{item.label}</SockethubButton>
                </li>
            {/each}
        </ul>
    </details>
</BaseExample>
