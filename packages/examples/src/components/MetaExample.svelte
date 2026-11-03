<script lang="ts">
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import { setCredentials as acceptCredentials } from "$lib/set-credentials";
import { contextFor, ensureClientReady, sc, send } from "$lib/sockethub";

let { platform }: { platform: "messenger" | "instagram" } = $props();
const title = $derived(platform === "messenger" ? "Messenger" : "Instagram");
const limit = $derived(platform === "messenger" ? 2000 : 1000);
let accountId = $state("");
let token = $state("");
let apiVersion = $state("");
let recipientId = $state("");
let content = $state("");
let humanAgent = $state(false);
let credentialsSet = $state(false);
let credentialAccount: { platform: string; actorId: string } | undefined;
let busy = $state(false);
let error = $state("");
let status = $state("");
const canSetCredentials = $derived(
    /^[0-9]+$/.test(accountId) &&
        token.length > 0 &&
        /^v[0-9]{1,3}\.[0-9]{1,2}$/.test(apiVersion),
);
const canSend = $derived(
    credentialsSet &&
        /^[0-9]+$/.test(recipientId) &&
        content.trim().length > 0 &&
        Array.from(content).length <= limit,
);

function invalidateCredentials(): void {
    credentialsSet = false;
    status = "";
    error = "";
    humanAgent = false;
    forgetCredentials();
}

function forgetCredentials(): void {
    if (credentialAccount) {
        sc?.clearCredentials(credentialAccount);
        credentialAccount = undefined;
    }
}

async function setCredentials(): Promise<void> {
    busy = true;
    error = "";
    status = "";
    try {
        await ensureClientReady();
        const context = await contextFor(platform);
        credentialAccount = { platform, actorId: accountId };
        await acceptCredentials(sc.socket, {
            "@context": context,
            type: "credentials",
            actor: { id: accountId, type: "person" },
            object: { type: "credentials", token, apiVersion },
        });
        credentialsSet = true;
        status =
            "Credentials set for this session. Meta checks the token when you send.";
    } catch (err) {
        forgetCredentials();
        error = err instanceof Error ? err.message : String(err);
    } finally {
        busy = false;
    }
}

async function sendMessage(): Promise<void> {
    busy = true;
    error = "";
    status = "";
    try {
        const response = await send({
            "@context": await contextFor(platform),
            type: "send",
            actor: { id: accountId, type: "person" },
            target: { id: recipientId, type: "person" },
            object: {
                type: "message",
                content,
                ...(humanAgent ? { humanAgent: true } : {}),
            },
        });
        status = `Accepted by Meta. Message ID: ${response.object?.id ?? "unknown"}. Delivery is not confirmed.`;
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    } finally {
        busy = false;
    }
}

async function clearCredentials(): Promise<void> {
    invalidateCredentials();
    token = "";
    recipientId = "";
    content = "";
    status =
        "Local credentials cleared. To end the server session too, disconnect from Sockethub.";
}
</script>

<BaseExample title="{title} Platform Example" description="Send a text reply using your own Meta business account.">
    <p class="text-gray-600 text-sm">
        {platform === "messenger" ? "Use a Facebook Page access token with pages_messaging." : "Use an Instagram Login token with instagram_business_manage_messages for a Business or Creator account."}
        Incoming messages are handled elsewhere. Get the recipient's scoped ID from that integration.
    </p>
    <fieldset disabled={busy} class="space-y-4">
        <legend class="text-lg font-semibold mb-4">Account credentials</legend>
        <FormField label={platform === "messenger" ? "Facebook Page ID" : "Instagram account ID"} id="meta-account" bind:value={accountId} onInput={invalidateCredentials} />
        <FormField label="Access token" id="meta-token" type="password" bind:value={token} onInput={invalidateCredentials} />
        <FormField label="Graph API version" id="meta-version" placeholder="e.g. v22.0 — use a version supported by your app" bind:value={apiVersion} onInput={invalidateCredentials} />
        <div class="flex flex-wrap gap-3">
            <SockethubButton buttonAction={setCredentials} disabled={!canSetCredentials || busy || credentialsSet}>
                {credentialsSet ? "Credentials Set" : "Set Credentials"}
            </SockethubButton>
            <button type="button" onclick={clearCredentials} disabled={busy || (!token && !credentialsSet)} class="px-6 py-3 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">Clear Credentials</button>
        </div>
    </fieldset>
    <fieldset disabled={busy} class="space-y-4">
        <legend class="text-lg font-semibold mb-4">Send a reply</legend>
        <FormField label={platform === "messenger" ? "Recipient Page-scoped ID (PSID)" : "Recipient Instagram-scoped ID (IGSID)"} id="meta-recipient" bind:value={recipientId} />
        <div class="space-y-2">
            <label for="meta-message" class="block text-sm font-semibold text-gray-700">Message</label>
            <textarea id="meta-message" bind:value={content} rows="4" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900"></textarea>
            <p class="text-sm text-gray-600">{Array.from(content).length} / {limit} characters</p>
        </div>
        <label class="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" bind:checked={humanAgent} />
            Human Agent reply (requires Meta approval)
        </label>
        <p class="text-sm text-gray-600">
            Leave unchecked for standard replies. Enable only for a manual support reply
            eligible for Meta's seven-day Human Agent window. Your replies do not extend the window.
        </p>
        <SockethubButton buttonAction={sendMessage} disabled={!canSend || busy}>{busy ? "Working…" : "Send Message"}</SockethubButton>
    </fieldset>
    {#if error}
        <p role="alert" class="text-red-800 bg-red-50 border border-red-200 rounded-lg p-4 whitespace-pre-wrap break-words">{error}</p>
    {/if}
    {#if status}
        <p role="status" class="text-green-800 bg-green-50 border border-green-200 rounded-lg p-4 break-words">{status}</p>
    {/if}
</BaseExample>
