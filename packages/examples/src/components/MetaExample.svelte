<script lang="ts">
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import Step from "$components/Step.svelte";
import { setCredentials as acceptCredentials } from "$lib/set-credentials";
import { contextFor, ensureClientReady, sc, send } from "$lib/sockethub";

let { platform }: { platform: "messenger" | "instagram" } = $props();
const title = $derived(platform === "messenger" ? "Messenger" : "Instagram");
const limit = $derived(platform === "messenger" ? 2000 : 1000);
let accountId = $state("");
let token = $state("");
let apiVersion = $state("");
let login = $state<"instagram" | "facebook">("instagram");
let pageId = $state("");
let recipientId = $state("");
let content = $state("");
let humanAgent = $state(false);
// Messenger limits characters; Instagram limits UTF-8 bytes.
const unit = $derived(platform === "messenger" ? "characters" : "bytes");
const contentLength = $derived(
    platform === "messenger"
        ? Array.from(content).length
        : new TextEncoder().encode(content).length,
);
let credentialsSet = $state(false);
let credentialAccount: { platform: string; actorId: string } | undefined;
let busy = $state(false);
let error = $state("");
let status = $state("");
const canSetCredentials = $derived(
    /^[0-9]+$/.test(accountId) &&
        token.length > 0 &&
        /^v[0-9]{1,3}\.[0-9]{1,2}$/.test(apiVersion) &&
        (platform !== "instagram" ||
            login !== "facebook" ||
            /^[0-9]+$/.test(pageId)),
);
const canSend = $derived(
    credentialsSet &&
        /^[0-9]+$/.test(recipientId) &&
        content.trim().length > 0 &&
        contentLength <= limit,
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
            object: {
                type: "credentials",
                token,
                apiVersion,
                ...(platform === "instagram"
                    ? { login, ...(login === "facebook" ? { pageId } : {}) }
                    : {}),
            },
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

<BaseExample platform={platform} title="{title} Platform Example" description="Send a text reply from your own Meta business account. Incoming messages arrive through your webhook integration, which also gives you the recipient's scoped ID.">
    <Step n={1} title="Set account credentials" description={platform === "messenger" ? "Use a Facebook Page access token with the pages_messaging permission." : login === "facebook" ? "Use a Page access token with instagram_manage_messages for the linked professional account." : "Use an Instagram Login token with instagram_business_manage_messages for a Business or Creator account."} done={credentialsSet}>
        <fieldset disabled={busy} class="space-y-4">
            <legend class="sr-only">Account credentials</legend>
            {#if platform === "instagram"}
                <div class="space-y-1.5">
                    <label for="meta-login" class="label">Login method</label>
                    <select id="meta-login" bind:value={login} onchange={invalidateCredentials} class="input">
                        <option value="instagram">Instagram Login</option>
                        <option value="facebook">Facebook Login (Page token)</option>
                    </select>
                </div>
                {#if login === "facebook"}
                    <FormField label="Linked Facebook Page ID" id="meta-page" bind:value={pageId} error={pageId && !/^[0-9]+$/.test(pageId) ? "Use digits only." : undefined} onInput={invalidateCredentials} />
                {/if}
            {/if}
            <FormField label={platform === "messenger" ? "Facebook Page ID" : "Instagram account ID"} id="meta-account" bind:value={accountId} error={accountId && !/^[0-9]+$/.test(accountId) ? "Use digits only." : undefined} onInput={invalidateCredentials} />
            <FormField label="Access token" id="meta-token" type="password" bind:value={token} onInput={invalidateCredentials} />
            <FormField label="Graph API version" id="meta-version" placeholder="v22.0" hint="Use a version your Meta app supports, e.g. v22.0." error={apiVersion && !/^v[0-9]{1,3}\.[0-9]{1,2}$/.test(apiVersion) ? "Write it as v followed by the version, e.g. v22.0." : undefined} bind:value={apiVersion} onInput={invalidateCredentials} />
            <div class="flex flex-wrap justify-end gap-2">
                <button type="button" onclick={clearCredentials} disabled={busy || (!token && !credentialsSet)} class="btn btn-secondary">Clear credentials</button>
                <SockethubButton buttonAction={setCredentials} disabled={!canSetCredentials || busy || credentialsSet}>
                    {credentialsSet ? "Credentials set" : "Set credentials"}
                </SockethubButton>
            </div>
        </fieldset>
    </Step>
    <Step n={2} title="Send a reply" description="Sends a send activity. Meta accepts it and delivers it asynchronously." blockedHint={credentialsSet ? undefined : "Set credentials first."}>
        <fieldset disabled={busy} class="space-y-4">
            <legend class="sr-only">Send a reply</legend>
            <FormField label={platform === "messenger" ? "Recipient Page-scoped ID (PSID)" : "Recipient Instagram-scoped ID (IGSID)"} id="meta-recipient" bind:value={recipientId} />
            <div class="space-y-1.5">
                <div class="flex items-baseline justify-between">
                    <label for="meta-message" class="label">Message</label>
                    <span class="text-xs tabular-nums {contentLength > limit ? 'font-semibold text-red-700' : 'text-zinc-500'}">{contentLength} / {limit} {unit}</span>
                </div>
                <textarea id="meta-message" bind:value={content} rows="4" class="input"></textarea>
            </div>
            <label class="flex items-start gap-2.5 text-sm text-zinc-700">
                <input class="check mt-0.5" type="checkbox" bind:checked={humanAgent} />
                <span>
                    <span class="font-medium text-zinc-900">Human Agent reply (requires Meta approval)</span>
                    <span class="mt-0.5 block text-[13px] leading-relaxed text-zinc-500">Leave unchecked for standard replies. Only for a manual support reply inside Meta's seven-day Human Agent window. Your replies do not extend the window.</span>
                </span>
            </label>
            <div class="flex justify-end">
                <SockethubButton buttonAction={sendMessage} disabled={!canSend || busy}>{busy ? "Working…" : "Send message"}</SockethubButton>
            </div>
        </fieldset>
    </Step>
    {#if error}
        <p role="alert" class="callout callout-error">{error}</p>
    {/if}
    {#if status}
        <p role="status" class="callout callout-success break-words">{status}</p>
    {/if}
</BaseExample>
