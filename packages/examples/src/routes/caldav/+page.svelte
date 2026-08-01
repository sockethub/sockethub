<script lang="ts">
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { contextFor, ensureClientReady, sc, send } from "$lib/sockethub";
import type { AnyActivityStream, SockethubResponse } from "$lib/sockethub";

type Calendar = {
    id: string;
    type: "calendar";
    name: string;
    components: ("event" | "task")[];
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
                typeof item.name === "string" &&
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
    title="CalDAV Platform Example"
    description="Discover the calendars in a CalDAV account, then add an event or to-do."
>
    <section class="space-y-4">
        <h2 class="text-xl font-semibold text-gray-900">1. Set credentials</h2>
        <p class="text-sm text-gray-600">
            Use an app password when your calendar provider supports one. Credentials stay in this Sockethub session.
        </p>
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
        <div class="flex justify-end">
            <SockethubButton
                buttonAction={setCredentials}
                disabled={credentialsSet || busy || !actorId || !serviceUrl || !username || !password}
            >
                {credentialsSet ? "Credentials Set" : busy ? "Setting Credentials…" : "Set Credentials"}
            </SockethubButton>
        </div>
        {#if credentialError}
            <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                {credentialError}
            </div>
        {/if}
        {#if credentialSuccess}
            <div class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">
                {credentialSuccess}
            </div>
        {/if}
    </section>

    <section class="space-y-4 border-t border-gray-200 pt-6">
        <h2 class="text-xl font-semibold text-gray-900">2. Choose a calendar</h2>
        <div class="flex justify-end">
            <SockethubButton buttonAction={fetchCalendars} disabled={busy || !credentialsSet}>
                Fetch Calendars
            </SockethubButton>
        </div>
        {#if calendars.length > 0}
            <label for="caldav-calendar" class="block text-sm font-semibold text-gray-700">Calendar</label>
            <select
                id="caldav-calendar"
                bind:value={selectedCalendarId}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3"
            >
                {#each calendars as calendar (calendar.id)}
                    <option value={calendar.id}>
                        {calendar.name} ({calendar.components.join(", ")})
                    </option>
                {/each}
            </select>
        {/if}
    </section>

    <section class="space-y-4 border-t border-gray-200 pt-6">
        <h2 class="text-xl font-semibold text-gray-900">3. Add an item</h2>
        <div class="flex gap-6">
            <label class="flex items-center gap-2">
                <input
                    type="radio"
                    bind:group={itemType}
                    value="event"
                    disabled={Boolean(selectedCalendar && !selectedCalendar.components.includes("event"))}
                /> Event
            </label>
            <label class="flex items-center gap-2">
                <input
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
        <div class="flex justify-end">
            <SockethubButton
                buttonAction={createItem}
                disabled={busy || !itemTypeSupported || !name || (itemType === "event" && !startTime)}
            >
                Add {itemType === "event" ? "Event" : "To-do"}
            </SockethubButton>
        </div>
    </section>

    {#if error}
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>
    {/if}
    {#if success}
        <div class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">{success}</div>
    {/if}
</BaseExample>
