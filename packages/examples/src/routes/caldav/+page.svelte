<script lang="ts">
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import Step from "$components/Step.svelte";
import { contextFor, ensureClientReady, sc, send } from "$lib/sockethub";
import type { AnyActivityStream, SockethubResponse } from "$lib/sockethub";

type Calendar = {
    id: string;
    type: "calendar";
    name: string;
    components: ("event" | "task")[];
};
type FeedItem = {
    id: string;
    type: "event" | "task";
    name: string;
    startTime?: string;
    endTime?: string;
    due?: string;
    allDay?: boolean;
    location?: string;
};

let actorId = $state("caldav:alice");
let serviceUrl = $state("");
let username = $state("");
let password = $state("");
let credentialsSet = $state(false);
let calendars = $state<Calendar[]>([]);
let selectedCalendarId = $state("");
let itemType = $state<"event" | "task">("event");
let name = $state("");
let startTime = $state("");
let endTime = $state("");
let due = $state("");
let busy = $state(false);
let error = $state<string | null>(null);
let success = $state<string | null>(null);
let credentialError = $state<string | null>(null);
let credentialSuccess = $state<string | null>(null);
let feedUrl = $state("");
let upcomingOnly = $state(true);
let feedName = $state("");
let feedItems = $state<FeedItem[]>([]);
let feedBusy = $state(false);
let feedError = $state<string | null>(null);

const selectedCalendar = $derived(
    calendars.find((calendar) => calendar.id === selectedCalendarId),
);
const itemTypeSupported = $derived(
    selectedCalendar?.components.includes(itemType) ?? false,
);

function actor() {
    return { id: actorId, type: "person" };
}

function invalidateCredentials(): void {
    if (!credentialsSet) return;
    credentialsSet = false;
    calendars = [];
    selectedCalendarId = "";
    credentialError = null;
    credentialSuccess = null;
}

async function setCredentials(): Promise<void> {
    credentialError = null;
    credentialSuccess = null;
    busy = true;
    try {
        await ensureClientReady();
        const credentials = {
            "@context": await contextFor("caldav"),
            type: "credentials",
            actor: actor(),
            object: {
                type: "credentials",
                url: serviceUrl,
                username,
                password,
            },
        };
        await new Promise<void>((resolve, reject) => {
            sc.socket.emit(
                "credentials",
                credentials,
                (response: SockethubResponse) => {
                    if (response?.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    resolve();
                },
            );
        });
        credentialsSet = true;
        credentialSuccess = "Credentials set for this Sockethub session.";
    } catch (err) {
        credentialError = err instanceof Error ? err.message : String(err);
    } finally {
        busy = false;
    }
}

async function fetchCalendars(): Promise<void> {
    error = null;
    success = null;
    busy = true;
    try {
        const response = await send({
            "@context": await contextFor("caldav"),
            type: "fetch",
            actor: actor(),
        } as AnyActivityStream);
        calendars = (response.items ?? []).filter(
            (item): item is AnyActivityStream & Calendar =>
                item.type === "calendar" &&
                typeof item.id === "string" &&
                typeof (item as unknown as Calendar).name === "string" &&
                Array.isArray((item as unknown as Calendar).components),
        ) as Calendar[];
        selectedCalendarId = calendars[0]?.id ?? "";
        success = `Found ${calendars.length} calendar${calendars.length === 1 ? "" : "s"}.`;
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    } finally {
        busy = false;
    }
}

async function readFeed(): Promise<void> {
    feedError = null;
    feedBusy = true;
    try {
        const response = await send({
            "@context": await contextFor("caldav"),
            type: "read",
            actor: actor(),
            target: { id: feedUrl, type: "feed" },
            ...(upcomingOnly
                ? { object: { startTime: new Date().toISOString() } }
                : {}),
        } as unknown as AnyActivityStream);
        feedName = typeof response.summary === "string" ? response.summary : "";
        feedItems = (response.items ?? []).filter(
            (item): item is AnyActivityStream & FeedItem =>
                (item.type === "event" || item.type === "task") &&
                typeof (item as unknown as FeedItem).name === "string",
        ) as FeedItem[];
    } catch (err) {
        feedItems = [];
        feedError = err instanceof Error ? err.message : String(err);
    } finally {
        feedBusy = false;
    }
}

function itemWhen(item: FeedItem): string {
    const when = item.startTime ?? item.due;
    if (!when) return "";
    return item.allDay || !when.includes("T")
        ? when
        : new Date(when).toLocaleString();
}

async function createItem(): Promise<void> {
    if (!selectedCalendar) return;
    error = null;
    success = null;
    busy = true;
    try {
        const object =
            itemType === "event"
                ? {
                      type: "event",
                      name,
                      startTime: new Date(startTime).toISOString(),
                      ...(endTime
                          ? { endTime: new Date(endTime).toISOString() }
                          : {}),
                  }
                : {
                      type: "task",
                      name,
                      ...(due ? { due: new Date(due).toISOString() } : {}),
                  };
        await send({
            "@context": await contextFor("caldav"),
            type: "create",
            actor: actor(),
            target: { id: selectedCalendar.id, type: "calendar" },
            object,
        } as unknown as AnyActivityStream);
        success = `${itemType === "event" ? "Event" : "To-do"} created.`;
        name = "";
        startTime = "";
        endTime = "";
        due = "";
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    } finally {
        busy = false;
    }
}
</script>

<BaseExample
    platform="caldav"
    title="CalDAV Platform Example"
    description="Discover the calendars in a CalDAV account and add an event or to-do, or list the events in a published .ics feed."
>
    <Step n={1} title="Set credentials" description="Use an app password if your provider offers one. Credentials stay in this Sockethub session." done={credentialsSet}>
        <FormField
            label="Actor ID"
            id="caldav-actor"
            bind:value={actorId}
            placeholder="caldav:alice"
            onInput={invalidateCredentials}
        />
        <FormField
            label="CalDAV URL"
            id="caldav-url"
            type="url"
            bind:value={serviceUrl}
            placeholder="https://calendar.example/dav/"
            onInput={invalidateCredentials}
        />
        <FormField label="Username" id="caldav-username" bind:value={username} onInput={invalidateCredentials} />
        <FormField
            label="Password"
            id="caldav-password"
            type="password"
            bind:value={password}
            onInput={invalidateCredentials}
        />
        <div class="flex flex-wrap justify-end gap-2">
            <SockethubButton
                buttonAction={setCredentials}
                disabled={credentialsSet || busy || !actorId || !serviceUrl || !username || !password}
            >
                {credentialsSet ? "Credentials Set" : busy ? "Setting Credentials…" : "Set Credentials"}
            </SockethubButton>
        </div>
        {#if credentialError}
            <div class="callout callout-error" role="alert">
                {credentialError}
            </div>
        {/if}
        {#if credentialSuccess}
            <div class="callout callout-success" role="status">
                {credentialSuccess}
            </div>
        {/if}
    </Step>

    <Step n={2} title="Choose a calendar" description="Sends a fetch activity. Sockethub discovers the calendars in your account." done={calendars.length > 0}>
        <div class="flex flex-wrap justify-end gap-2">
            <SockethubButton buttonAction={fetchCalendars} disabled={busy || !credentialsSet}>
                Fetch Calendars
            </SockethubButton>
        </div>
        {#if calendars.length > 0}
            <label for="caldav-calendar" class="label">Calendar</label>
            <select
                id="caldav-calendar"
                bind:value={selectedCalendarId}
                class="input"
            >
                {#each calendars as calendar (calendar.id)}
                    <option value={calendar.id}>
                        {calendar.name} ({calendar.components.join(", ")})
                    </option>
                {/each}
            </select>
        {/if}
    </Step>

    <Step n={3} title="Add an item" description="Sends a create activity targeting the chosen calendar.">
        <div class="flex gap-6 text-sm font-medium text-zinc-800">
            <label class="flex items-center gap-2">
                <input
                    class="check"
                    type="radio"
                    bind:group={itemType}
                    value="event"
                    disabled={Boolean(selectedCalendar && !selectedCalendar.components.includes("event"))}
                /> Event
            </label>
            <label class="flex items-center gap-2">
                <input
                    class="check"
                    type="radio"
                    bind:group={itemType}
                    value="task"
                    disabled={Boolean(selectedCalendar && !selectedCalendar.components.includes("task"))}
                /> To-do
            </label>
        </div>
        <FormField label="Name" id="caldav-item-name" bind:value={name} />
        {#if itemType === "event"}
            <FormField label="Starts" id="caldav-start" type="datetime-local" bind:value={startTime} />
            <FormField label="Ends (optional)" id="caldav-end" type="datetime-local" bind:value={endTime} />
        {:else}
            <FormField label="Due (optional)" id="caldav-due" type="datetime-local" bind:value={due} />
        {/if}
        <div class="flex flex-wrap justify-end gap-2">
            <SockethubButton
                buttonAction={createItem}
                disabled={busy || !itemTypeSupported || !name || (itemType === "event" && !startTime)}
            >
                Add {itemType === "event" ? "Event" : "To-do"}
            </SockethubButton>
        </div>
    </Step>

    {#if error}
        <div class="callout callout-error" role="alert">{error}</div>
    {/if}
    {#if success}
        <div class="callout callout-success" role="status">{success}</div>
    {/if}

    <Step title="Or read a public calendar feed" description="Public .ics and webcal:// links need no credentials. Sends a read activity and lists what comes back.">
        <FormField
            label="Feed URL"
            id="caldav-feed-url"
            type="url"
            bind:value={feedUrl}
            placeholder="https://example.org/holidays.ics"
        />
        <label class="flex items-center gap-2 text-sm text-zinc-700">
            <input class="check" type="checkbox" bind:checked={upcomingOnly} /> Upcoming items only
        </label>
        <div class="flex flex-wrap justify-end gap-2">
            <SockethubButton buttonAction={readFeed} disabled={feedBusy || !actorId || !feedUrl}>
                {feedBusy ? "Reading…" : "Read Feed"}
            </SockethubButton>
        </div>
        {#if feedError}
            <div class="callout callout-error" role="alert">{feedError}</div>
        {/if}
        {#if feedItems.length > 0}
            <h3 class="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{feedName || "Feed"} ({feedItems.length})</h3>
            <ul class="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
                {#each feedItems as item, index (`${index}:${item.id}`)}
                    <li class="flex flex-col gap-1 px-4 py-3 text-sm">
                        <span class="font-medium text-zinc-900">{item.name}</span>
                        <span class="text-zinc-600">
                            {item.type === "task" ? "To-do" : "Event"}
                            {#if itemWhen(item)}
                                · {itemWhen(item)}
                            {/if}
                            {#if item.location}
                                · {item.location}
                            {/if}
                        </span>
                    </li>
                {/each}
            </ul>
        {/if}
    </Step>
</BaseExample>
