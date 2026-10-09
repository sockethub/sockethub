<script lang="ts">
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { contextFor, ensureClientReady, sc, send } from "$lib/sockethub";
import type { AnyActivityStream } from "$lib/sockethub";

type AddressBook = {
    id: string;
    type: "addressBook";
    name: string;
    description?: string;
};

type TypedValue = { value: string; types?: string[]; preferred?: boolean };

type Address = {
    types?: string[];
    street?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
};

type Contact = {
    id: string;
    type: "person";
    uid: string;
    etag?: string;
    name: string;
    givenName?: string;
    familyName?: string;
    nickname?: string;
    emails?: TypedValue[];
    telephones?: TypedValue[];
    addresses?: Address[];
    organization?: string;
    title?: string;
    urls?: TypedValue[];
    photoUrls?: string[];
    note?: string;
    birthday?: string;
};

type SearchField = "all" | "name" | "email" | "telephone" | "organization";

let actorId = $state("carddav:alice");
let serviceUrl = $state("");
let username = $state("");
let password = $state("");
let credentialsSet = $state(false);
let addressBooks = $state<AddressBook[]>([]);
let selectedAddressBookId = $state("");
let searchText = $state("");
let searchField = $state<SearchField>("all");
let contacts = $state<Contact[]>([]);
let editing = $state<Contact | null>(null);
let formName = $state("");
let formGivenName = $state("");
let formFamilyName = $state("");
let formEmail = $state("");
let formTelephone = $state("");
let formOrganization = $state("");
let formNote = $state("");
let busy = $state(false);
let error = $state<string | null>(null);
let success = $state<string | null>(null);
let credentialError = $state<string | null>(null);
let credentialSuccess = $state<string | null>(null);
let credentialRevision = 0;
let contactRequestRevision = 0;

const selectedAddressBook = $derived(
    addressBooks.find(
        (addressBook) => addressBook.id === selectedAddressBookId,
    ),
);
const canSubmitContact = $derived(
    Boolean(credentialsSet && selectedAddressBook && formName.trim()),
);

function actor() {
    return { id: actorId, type: "person" };
}

function target(addressBookId: string) {
    return { id: addressBookId, type: "addressBook" };
}

function describeError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "carddav:conflict") {
        return "carddav:conflict — another client changed this contact. Refresh the list and try again with the current version.";
    }
    return message;
}

function clearForm(): void {
    editing = null;
    formName = "";
    formGivenName = "";
    formFamilyName = "";
    formEmail = "";
    formTelephone = "";
    formOrganization = "";
    formNote = "";
}

function invalidateCredentials(): void {
    credentialRevision += 1;
    contactRequestRevision += 1;
    credentialsSet = false;
    addressBooks = [];
    selectedAddressBookId = "";
    contacts = [];
    clearForm();
    credentialError = null;
    credentialSuccess = null;
}

function selectAddressBook(): void {
    contactRequestRevision += 1;
    contacts = [];
    clearForm();
    error = null;
    success = null;
}

function startEdit(contact: Contact): void {
    editing = contact;
    formName = contact.name;
    formGivenName = contact.givenName ?? "";
    formFamilyName = contact.familyName ?? "";
    formEmail = contact.emails?.[0]?.value ?? "";
    formTelephone = contact.telephones?.[0]?.value ?? "";
    formOrganization = contact.organization ?? "";
    formNote = contact.note ?? "";
    error = null;
    success = null;
}

async function setCredentials(): Promise<void> {
    const revision = credentialRevision;
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
                (response?: { error?: string }) => {
                    if (response?.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    resolve();
                },
            );
        });
        if (revision === credentialRevision) {
            credentialsSet = true;
            credentialSuccess = "Credentials set for this Sockethub session.";
        }
    } catch (err) {
        if (revision === credentialRevision) {
            credentialError = describeError(err);
        }
    } finally {
        busy = false;
    }
}

async function fetchAddressBooks(): Promise<void> {
    if (!credentialsSet) return;
    const revision = credentialRevision;
    error = null;
    success = null;
    contacts = [];
    clearForm();
    busy = true;
    try {
        const response = await send({
            "@context": await contextFor("carddav"),
            type: "fetch",
            actor: actor(),
        } as AnyActivityStream);
        if (revision !== credentialRevision || !credentialsSet) return;
        addressBooks = (response.items ?? []).filter(
            (item): item is AnyActivityStream & AddressBook =>
                item.type === "addressBook" &&
                typeof item.id === "string" &&
                typeof (item as unknown as AddressBook).name === "string",
        ) as AddressBook[];
        selectedAddressBookId = addressBooks[0]?.id ?? "";
        success = `Found ${addressBooks.length} address book${addressBooks.length === 1 ? "" : "s"}.`;
    } catch (err) {
        if (revision === credentialRevision) {
            error = describeError(err);
        }
    } finally {
        busy = false;
    }
}

/**
 * Lists or searches the selected address book. Without text the platform
 * returns every contact; with text it runs a CardDAV addressbook-query
 * REPORT over the chosen fields.
 */
async function queryContacts(): Promise<void> {
    if (!credentialsSet || !selectedAddressBook) return;
    const revision = credentialRevision;
    const requestRevision = ++contactRequestRevision;
    const addressBookId = selectedAddressBook.id;
    const text = searchText.trim();
    error = null;
    success = null;
    busy = true;
    try {
        const response = await send({
            "@context": await contextFor("carddav"),
            type: "query",
            actor: actor(),
            target: target(addressBookId),
            object: {
                type: "contactQuery",
                ...(text ? { text } : {}),
                ...(text && searchField !== "all"
                    ? { fields: [searchField] }
                    : {}),
                limit: 100,
            },
        } as unknown as AnyActivityStream);
        if (
            revision !== credentialRevision ||
            requestRevision !== contactRequestRevision ||
            selectedAddressBookId !== addressBookId ||
            !credentialsSet
        )
            return;
        contacts = (response.items ?? []).filter(
            (item): item is AnyActivityStream & Contact =>
                item.type === "person" &&
                typeof item.id === "string" &&
                typeof (item as unknown as Contact).name === "string",
        ) as Contact[];
        success = text
            ? `Found ${contacts.length} contact${contacts.length === 1 ? "" : "s"} matching “${text}”.`
            : `Listed ${contacts.length} contact${contacts.length === 1 ? "" : "s"}.`;
    } catch (err) {
        if (
            revision === credentialRevision &&
            requestRevision === contactRequestRevision
        ) {
            error = describeError(err);
        }
    } finally {
        busy = false;
    }
}

/**
 * Replaces the first entry of a multi-valued field with the form value while
 * keeping any further entries the contact already had. An empty form value
 * removes the first entry.
 */
function mergeFirst(
    existing: TypedValue[] | undefined,
    value: string,
): TypedValue[] | undefined {
    const rest = existing?.slice(1) ?? [];
    const merged = value
        ? [{ ...(existing?.[0] ?? {}), value }, ...rest]
        : rest;
    return merged.length ? merged : undefined;
}

function contactFromForm(base?: Contact) {
    const emails = mergeFirst(base?.emails, formEmail.trim());
    const telephones = mergeFirst(base?.telephones, formTelephone.trim());
    return {
        name: formName.trim(),
        ...(formGivenName.trim() ? { givenName: formGivenName.trim() } : {}),
        ...(formFamilyName.trim() ? { familyName: formFamilyName.trim() } : {}),
        ...(emails ? { emails } : {}),
        ...(telephones ? { telephones } : {}),
        ...(formOrganization.trim()
            ? { organization: formOrganization.trim() }
            : {}),
        ...(formNote.trim() ? { note: formNote.trim() } : {}),
    };
}

/**
 * Creates a new vCard, or updates the one being edited. An update sends the
 * complete contact returned by query (including id, uid, and etag) with the
 * edited fields applied, so the server can refuse it if the card changed.
 */
async function saveContact(): Promise<void> {
    if (!credentialsSet || !selectedAddressBook || !formName.trim()) return;
    const revision = credentialRevision;
    const addressBookId = selectedAddressBook.id;
    const current = editing;
    error = null;
    success = null;
    busy = true;
    try {
        const context = await contextFor("carddav");
        if (current) {
            const {
                emails: _emails,
                telephones: _telephones,
                givenName: _givenName,
                familyName: _familyName,
                organization: _organization,
                note: _note,
                ...rest
            } = current;
            await send({
                "@context": context,
                type: "update",
                actor: actor(),
                target: target(addressBookId),
                object: { ...rest, ...contactFromForm(current) },
            } as unknown as AnyActivityStream);
        } else {
            await send({
                "@context": context,
                type: "create",
                actor: actor(),
                target: target(addressBookId),
                object: { type: "person", ...contactFromForm() },
            } as unknown as AnyActivityStream);
        }
        if (revision !== credentialRevision || !credentialsSet) return;
        success = current ? "Contact updated." : "Contact created.";
        clearForm();
        await queryContacts();
    } catch (err) {
        if (revision === credentialRevision) {
            error = describeError(err);
        }
    } finally {
        busy = false;
    }
}

/** Deletes a contact only if its ETag still matches the stored version. */
async function deleteContact(contact: Contact): Promise<void> {
    if (!credentialsSet || !selectedAddressBook || !contact.etag) return;
    const revision = credentialRevision;
    const addressBookId = selectedAddressBook.id;
    error = null;
    success = null;
    busy = true;
    try {
        await send({
            "@context": await contextFor("carddav"),
            type: "delete",
            actor: actor(),
            target: target(addressBookId),
            object: { id: contact.id, type: "person", etag: contact.etag },
        } as unknown as AnyActivityStream);
        if (revision !== credentialRevision || !credentialsSet) return;
        if (editing?.id === contact.id) clearForm();
        contacts = contacts.filter((item) => item.id !== contact.id);
        success = `Deleted ${contact.name}.`;
    } catch (err) {
        if (revision === credentialRevision) {
            error = describeError(err);
        }
    } finally {
        busy = false;
    }
}

function formatAddress(address: Address): string {
    return [
        address.street,
        address.locality,
        address.region,
        address.postalCode,
        address.country,
    ]
        .filter(Boolean)
        .join(", ");
}

function formatTyped(value: TypedValue): string {
    const labels = [
        ...(value.preferred ? ["preferred"] : []),
        ...(value.types ?? []),
    ];
    return labels.length
        ? `${value.value} (${labels.join(", ")})`
        : value.value;
}
</script>

<BaseExample
    title="CardDAV Platform Example"
    description="Discover the address books in a CardDAV account, then list, search, add, edit, and delete contacts."
>
    <div class="bg-teal-50 border-l-4 border-teal-400 p-4 rounded-r-lg mb-6">
        <h3 class="text-lg font-semibold text-teal-800 mb-2">👤 How the CardDAV Platform Works</h3>
        <p class="text-teal-700 text-sm mb-3">
            Sockethub talks WebDAV and vCard to your contacts server so your app only has to send ActivityStreams.
        </p>
        <div class="text-teal-700 text-sm space-y-1">
            <div><strong>1. 🔐 Credentials:</strong> Sent once per session over the <code>credentials</code> event, never in an activity</div>
            <div><strong>2. 📚 fetch:</strong> Discovers the account's address books from the service URL</div>
            <div><strong>3. 🔍 query:</strong> Lists every contact, or runs a server-side search across name, email, telephone, or organization</div>
            <div><strong>4. ✏️ create / update / delete:</strong> Each contact carries an <code>etag</code>; updates and deletes are refused with <code>carddav:conflict</code> if another client changed the card first</div>
        </div>
    </div>

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
                onchange={selectAddressBook}
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
        <h2 class="text-xl font-semibold text-gray-900">3. Browse contacts</h2>
        <p class="text-sm text-gray-600">
            Leave the search empty to list every contact, or type text to search on the server.
        </p>
        <div class="grid gap-4 md:grid-cols-[1fr_auto]">
            <FormField label="Search text (optional)" id="carddav-search-text" bind:value={searchText} placeholder="Bob" />
            <div class="w-full space-y-2 md:w-48">
                <label for="carddav-search-field" class="block text-sm font-semibold text-gray-700">Search in</label>
                <select
                    id="carddav-search-field"
                    bind:value={searchField}
                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3"
                >
                    <option value="all">All fields</option>
                    <option value="name">Name</option>
                    <option value="email">Email</option>
                    <option value="telephone">Telephone</option>
                    <option value="organization">Organization</option>
                </select>
            </div>
        </div>
        <div class="flex justify-end">
            <SockethubButton buttonAction={queryContacts} disabled={busy || !credentialsSet || !selectedAddressBook}>
                {searchText.trim() ? "Search Contacts" : "List Contacts"}
            </SockethubButton>
        </div>
        {#if contacts.length > 0}
            <ul class="divide-y divide-gray-200 rounded-lg border border-gray-200">
                {#each contacts as contact (contact.id)}
                    <li class="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                        <div class="min-w-0 space-y-1">
                            <h3 class="font-semibold text-gray-900">
                                {contact.name}
                                {#if contact.nickname}
                                    <span class="font-normal text-gray-500">“{contact.nickname}”</span>
                                {/if}
                            </h3>
                            {#if contact.title || contact.organization}
                                <p class="text-sm text-gray-600">
                                    {[contact.title, contact.organization].filter(Boolean).join(" · ")}
                                </p>
                            {/if}
                            {#if contact.emails?.length}
                                <p class="text-sm text-gray-600">✉️ {contact.emails.map(formatTyped).join(", ")}</p>
                            {/if}
                            {#if contact.telephones?.length}
                                <p class="text-sm text-gray-600">📞 {contact.telephones.map(formatTyped).join(", ")}</p>
                            {/if}
                            {#each contact.addresses ?? [] as address}
                                {#if formatAddress(address)}
                                    <p class="text-sm text-gray-600">📍 {formatAddress(address)}</p>
                                {/if}
                            {/each}
                            {#if contact.urls?.length}
                                <p class="text-sm text-gray-600 break-all">🔗 {contact.urls.map((url) => url.value).join(", ")}</p>
                            {/if}
                            {#if contact.birthday}
                                <p class="text-sm text-gray-600">🎂 {contact.birthday}</p>
                            {/if}
                            {#if contact.note}
                                <p class="text-sm text-gray-600 whitespace-pre-wrap">{contact.note}</p>
                            {/if}
                            <p class="truncate text-xs text-gray-400" title={contact.id}>
                                uid {contact.uid}{contact.etag ? ` · etag ${contact.etag}` : ""}
                            </p>
                        </div>
                        <div class="flex shrink-0 gap-2">
                            <button
                                type="button"
                                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onclick={() => startEdit(contact)}
                                disabled={busy}
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                onclick={() => deleteContact(contact)}
                                disabled={busy || !contact.etag}
                                title={contact.etag ? "" : "This contact has no ETag, so it cannot be deleted safely"}
                            >
                                Delete
                            </button>
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    </section>

    <section class="space-y-4 border-t border-gray-200 pt-6">
        <h2 class="text-xl font-semibold text-gray-900">
            4. {editing ? `Edit ${editing.name}` : "Add a contact"}
        </h2>
        {#if editing}
            <p class="text-sm text-gray-600">
                The update sends the full contact back with its stored <code>etag</code>. Fields not shown here are kept as they are.
            </p>
        {/if}
        <FormField label="Full name" id="carddav-contact-name" bind:value={formName} placeholder="Bob Example" />
        <div class="grid gap-4 md:grid-cols-2">
            <FormField label="Given name" id="carddav-contact-given" bind:value={formGivenName} placeholder="Bob" />
            <FormField label="Family name" id="carddav-contact-family" bind:value={formFamilyName} placeholder="Example" />
        </div>
        <div class="grid gap-4 md:grid-cols-2">
            <FormField label="Email" id="carddav-contact-email" type="email" bind:value={formEmail} placeholder="bob@example.com" />
            <FormField label="Telephone" id="carddav-contact-telephone" type="tel" bind:value={formTelephone} placeholder="+1 555 0100" />
        </div>
        <FormField label="Organization" id="carddav-contact-organization" bind:value={formOrganization} />
        <FormField label="Note" id="carddav-contact-note" bind:value={formNote} />
        <div class="flex justify-end gap-2">
            {#if editing}
                <button
                    type="button"
                    class="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    onclick={clearForm}
                >
                    Cancel
                </button>
            {/if}
            <SockethubButton buttonAction={saveContact} disabled={busy || !canSubmitContact}>
                {editing ? "Save Changes" : "Add Contact"}
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
