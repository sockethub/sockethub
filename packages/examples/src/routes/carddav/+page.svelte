<script lang="ts">
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { contextFor, ensureClientReady, sc, send } from "$lib/sockethub";
import type { AnyActivityStream, SockethubResponse } from "$lib/sockethub";

type AddressBook = {
    id: string;
    type: "addressBook";
    name: string;
    description?: string;
};

type Contact = {
    id: string;
    type: "person";
    name: string;
    emails?: { value: string }[];
    telephones?: { value: string }[];
    organization?: string;
};

let actorId = $state("carddav:alice");
let serviceUrl = $state("");
let username = $state("");
let password = $state("");
let credentialsSet = $state(false);
let addressBooks = $state<AddressBook[]>([]);
let selectedAddressBookId = $state("");
let contactName = $state("");
let contacts = $state<Contact[]>([]);
let busy = $state(false);
let error = $state<string | null>(null);
let success = $state<string | null>(null);
let credentialError = $state<string | null>(null);
let credentialSuccess = $state<string | null>(null);

const selectedAddressBook = $derived(
    addressBooks.find(
        (addressBook) => addressBook.id === selectedAddressBookId,
    ),
);

function actor() {
    return { id: actorId, type: "person" };
}

function invalidateCredentials(): void {
    if (!credentialsSet) return;
    credentialsSet = false;
    addressBooks = [];
    selectedAddressBookId = "";
    contacts = [];
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
            "@context": await contextFor("carddav"),
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

async function fetchAddressBooks(): Promise<void> {
    error = null;
    success = null;
    contacts = [];
    busy = true;
    try {
        const response = await send({
            "@context": await contextFor("carddav"),
            type: "fetch",
            actor: actor(),
        } as AnyActivityStream);
        addressBooks = (response.items ?? []).filter(
            (item): item is AnyActivityStream & AddressBook =>
                item.type === "addressBook" &&
                typeof item.id === "string" &&
                typeof (item as unknown as AddressBook).name === "string",
        ) as AddressBook[];
        selectedAddressBookId = addressBooks[0]?.id ?? "";
        success = `Found ${addressBooks.length} address book${addressBooks.length === 1 ? "" : "s"}.`;
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    } finally {
        busy = false;
    }
}

async function queryContacts(): Promise<void> {
    if (!selectedAddressBook) return;
    error = null;
    success = null;
    contacts = [];
    busy = true;
    try {
        const response = await send({
            "@context": await contextFor("carddav"),
            type: "query",
            actor: actor(),
            target: { id: selectedAddressBook.id, type: "addressBook" },
            object: {
                type: "contactQuery",
                text: contactName,
                fields: ["name"],
                limit: 50,
            },
        } as unknown as AnyActivityStream);
        contacts = (response.items ?? []).filter(
            (item): item is AnyActivityStream & Contact =>
                item.type === "person" &&
                typeof item.id === "string" &&
                typeof (item as unknown as Contact).name === "string",
        ) as Contact[];
        success = `Found ${contacts.length} contact${contacts.length === 1 ? "" : "s"}.`;
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    } finally {
        busy = false;
    }
}
</script>

<BaseExample
    title="CardDAV Platform Example"
    description="Discover the address books in a CardDAV account, then find contacts by name."
>
    <section class="space-y-4">
        <h2 class="text-xl font-semibold text-gray-900">1. Set credentials</h2>
        <p class="text-sm text-gray-600">
            Use an app password when your contacts provider supports one. Credentials stay in this Sockethub session.
        </p>
        <FormField
            label="Actor ID"
            id="carddav-actor"
            bind:value={actorId}
            placeholder="carddav:alice"
            onInput={invalidateCredentials}
        />
        <FormField
            label="CardDAV URL"
            id="carddav-url"
            type="url"
            bind:value={serviceUrl}
            placeholder="https://contacts.example/dav/"
            onInput={invalidateCredentials}
        />
        <FormField label="Username" id="carddav-username" bind:value={username} onInput={invalidateCredentials} />
        <FormField
            label="Password"
            id="carddav-password"
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
        <h2 class="text-xl font-semibold text-gray-900">2. Choose an address book</h2>
        <div class="flex justify-end">
            <SockethubButton buttonAction={fetchAddressBooks} disabled={busy || !credentialsSet}>
                Fetch Address Books
            </SockethubButton>
        </div>
        {#if addressBooks.length > 0}
            <label for="carddav-address-book" class="block text-sm font-semibold text-gray-700">Address book</label>
            <select
                id="carddav-address-book"
                bind:value={selectedAddressBookId}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3"
            >
                {#each addressBooks as addressBook (addressBook.id)}
                    <option value={addressBook.id}>{addressBook.name}</option>
                {/each}
            </select>
            {#if selectedAddressBook?.description}
                <p class="text-sm text-gray-600">{selectedAddressBook.description}</p>
            {/if}
        {/if}
    </section>

    <section class="space-y-4 border-t border-gray-200 pt-6">
        <h2 class="text-xl font-semibold text-gray-900">3. Find contacts</h2>
        <FormField label="Contact name" id="carddav-contact-name" bind:value={contactName} placeholder="Bob" />
        <div class="flex justify-end">
            <SockethubButton buttonAction={queryContacts} disabled={busy || !selectedAddressBook || !contactName.trim()}>
                Search Contacts
            </SockethubButton>
        </div>
        {#if contacts.length > 0}
            <ul class="divide-y divide-gray-200 rounded-lg border border-gray-200">
                {#each contacts as contact (contact.id)}
                    <li class="space-y-1 p-4">
                        <h3 class="font-semibold text-gray-900">{contact.name}</h3>
                        {#if contact.organization}
                            <p class="text-sm text-gray-600">{contact.organization}</p>
                        {/if}
                        {#if contact.emails?.length}
                            <p class="text-sm text-gray-600">{contact.emails.map((email) => email.value).join(", ")}</p>
                        {/if}
                        {#if contact.telephones?.length}
                            <p class="text-sm text-gray-600">
                                {contact.telephones.map((telephone) => telephone.value).join(", ")}
                            </p>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </section>

    {#if error}
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">{error}</div>
    {/if}
    {#if success}
        <div class="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">{success}</div>
    {/if}
</BaseExample>
