<script lang="ts">
import { onMount } from "svelte";
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
import Step from "$components/Step.svelte";
import {
    contextFor,
    ensureClientReady,
    platformIdFromContext,
    sc,
    send,
} from "$lib/sockethub";
import type { AnyActivityStream, SockethubResponse } from "$lib/sockethub";

type Cursor = { uidValidity: string; uid: number };
type Mail = {
    id: string;
    subject?: string;
    content?: string;
    folder?: string;
    bodyOmitted?: boolean;
    from?: { address?: string; name?: string }[];
    attachments?: { filename?: string; contentType: string }[];
    to?: { address?: string }[];
};
type EmailResponse = AnyActivityStream & {
    cursors?: Record<string, Cursor>;
    hasMore?: boolean;
    object?: AnyActivityStream["object"] & {
        folder?: string;
        cursor?: Cursor;
        accepted?: string[];
        rejected?: string[];
    };
};
let address = $state("");
let displayName = $state("");
let servers = $state([
    {
        kind: "imap",
        label: "IMAP receiving",
        host: "",
        port: 993,
        secure: true,
        username: "",
        secret: "",
        auth: "password",
    },
    {
        kind: "smtp",
        label: "SMTP sending",
        host: "",
        port: 587,
        secure: false,
        username: "",
        secret: "",
        auth: "password",
    },
]);
let submittedActorId: string | undefined;
let disposed = false;
let listening = false;
let connected = $state(false);
let watching = $state(false);
let busy = $state(false);
let error = $state("");
let status = $state("");
let folders = $state("INBOX");
let watchFolder = $state("INBOX");
let fromFilter = $state("");
let toFilter = $state("");
let match = $state("any");
let cursors = $state<Record<string, Cursor>>({});
let hasMore = $state(false);
let messages = $state<Mail[]>([]);
let recipients = $state("");
let subject = $state("");
let content = $state("");
const receiving = $derived(connected && !!servers[0].host);
const sending = $derived(connected && !!servers[1].host);
const list = (value: string) =>
    value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
const actor = () => ({
    id: submittedActorId ?? address,
    type: "person",
    ...(displayName ? { name: displayName } : {}),
});

function filters() {
    return {
        ...(fromFilter.trim() ? { from: list(fromFilter) } : {}),
        ...(toFilter.trim() ? { to: list(toFilter) } : {}),
        match,
    };
}
function resetCursor() {
    cursors = {};
    hasMore = false;
}
function receive(message: EmailResponse) {
    if (platformIdFromContext(message["@context"]) !== "email") return;
    if (message.error) {
        error = message.error;
        if (message.type === "watch") watching = false;
    }
    if (message.type === "disconnect" || message.type === "error")
        connectionLost();
    if (message.type === "post" && message.object) {
        const mail = message.object as Mail;
        messages = [
            mail,
            ...messages.filter((item) => item.id !== mail.id),
        ].slice(0, 100);
    }
}
async function request(
    type: string,
    object?: Record<string, unknown>,
): Promise<EmailResponse> {
    return (await send({
        "@context": await contextFor("email"),
        type,
        actor: actor(),
        ...(object ? { object: { type: "message", ...object } } : {}),
    })) as EmailResponse;
}
async function perform(operation: () => Promise<void>) {
    busy = true;
    error = "";
    status = "";
    try {
        await operation();
    } catch (failure) {
        error = failure instanceof Error ? failure.message : String(failure);
    } finally {
        busy = false;
    }
}
async function connect() {
    await perform(async () => {
        await ensureClientReady();
        if (disposed) return;
        resetCursor();
        messages = [];
        if (!listening) {
            sc.socket.on("message", receive);
            sc.socket.on("disconnect", connectionLost);
            listening = true;
        }
        if (submittedActorId && submittedActorId !== address) clearAccount();
        submittedActorId = address;
        const settings: Record<string, unknown> = {
            type: "credentials",
            from: address,
        };
        for (const server of servers) {
            if (server.host.trim())
                settings[server.kind] = {
                    host: server.host.trim(),
                    port: Number(server.port),
                    secure: server.secure,
                    username: server.username,
                    [server.auth]: server.secret,
                };
        }
        await new Promise<void>((resolve, reject) => {
            sc.socket.emit(
                "credentials",
                {
                    "@context": sc.contextFor("email"),
                    type: "credentials",
                    actor: actor(),
                    object: settings,
                },
                (response: SockethubResponse) => {
                    if (response?.error) reject(new Error(response.error));
                    else resolve();
                },
            );
        });
        if (disposed) {
            clearAccount();
            return;
        }
        await request("connect");
        if (disposed) {
            await request("disconnect");
            clearAccount();
            return;
        }
        connected = true;
        status = "Connected. Fetch messages or start watching a folder.";
    });
}
async function disconnect() {
    await perform(async () => {
        await request("disconnect");
        connected = false;
        watching = false;
        clearAccount();
        resetCursor();
        status = "Disconnected.";
    });
}
async function fetchMail(next = false) {
    await perform(async () => {
        const result = await request("fetch", {
            folders: list(folders),
            ...filters(),
            ...(next ? { cursors } : {}),
            limit: 20,
        });
        if (!next) messages = [];
        for (const item of result.items ?? []) receive(item);
        cursors = next
            ? { ...cursors, ...result.cursors }
            : (result.cursors ?? {});
        hasMore = result.hasMore ?? false;
        status = `Fetched ${result.items?.length ?? 0} messages.${hasMore ? " More results are available." : ""}`;
    });
}
async function toggleWatch() {
    await perform(async () => {
        if (watching) {
            await request("unwatch");
            watching = false;
            status = "Stopped watching.";
        } else {
            await request("watch", { folder: watchFolder, ...filters() });
            watching = true;
            status = `Watching new messages in ${watchFolder}.`;
        }
    });
}
async function sendMail() {
    await perform(async () => {
        const result = await request("send", {
            to: list(recipients),
            subject,
            content,
        });
        status = `Accepted by server: ${result.object?.accepted?.join(", ") || "none"}. Rejected: ${result.object?.rejected?.join(", ") || "none"}.`;
    });
}
function clearAccount() {
    if (submittedActorId)
        sc?.clearCredentials({ platform: "email", actorId: submittedActorId });
}
function connectionLost() {
    clearAccount();
    resetCursor();
    connected = false;
    watching = false;
    status =
        "Sockethub connection lost. Reconnect before fetching or watching again.";
}
onMount(() => {
    return () => {
        disposed = true;
        sc?.socket.off("message", receive);
        sc?.socket.off("disconnect", connectionLost);
        clearAccount();
        if (connected) {
            sc.socket.emit(
                "message",
                {
                    "@context": sc.contextFor("email"),
                    type: "disconnect",
                    actor: actor(),
                },
                (response: SockethubResponse) => {
                    if (response?.error)
                        console.warn("Email disconnect failed", response.error);
                },
            );
        }
    };
});
</script>

<BaseExample platform="email" title="Email Platform Example" description="Fetch and watch messages with IMAP, and send through SMTP. Messages remain on your mail server.">
    <Step n={1} title="Connect your account" description="Set up receiving, sending, or both. Leave a host blank to turn that side off. Use an app password or an OAuth access token." done={connected}>
        <fieldset disabled={connected || busy} class="space-y-4">
            <FormField label="Your email address" id="email-address" type="email" bind:value={address} />
            <FormField label="Sender name (optional)" id="email-sender-name" bind:value={displayName} />
            <div class="grid gap-6 md:grid-cols-2">
                {#each servers as server (server.kind)}
                    <fieldset class="space-y-3 rounded-lg border border-zinc-200 p-4">
                        <legend class="px-1 text-sm font-semibold text-zinc-900">{server.label}</legend>
                        <FormField label="Host" id="email-{server.kind}-host" bind:value={server.host} />
                        <FormField label="Port" id="email-{server.kind}-port" type="number" bind:value={server.port} />
                        <label class="flex items-center gap-2 text-sm text-zinc-700"><input class="check" type="checkbox" bind:checked={server.secure} /> TLS from connection start</label>
                        <p class="hint -mt-2">When unchecked, STARTTLS is required.</p>
                        <FormField label="Username" id="email-{server.kind}-username" bind:value={server.username} />
                        <div class="space-y-1.5">
                            <label for="email-{server.kind}-auth" class="label">Authentication</label>
                            <select id="email-{server.kind}-auth" bind:value={server.auth} class="input">
                                <option value="password">Password / app password</option><option value="token">OAuth access token</option>
                            </select>
                        </div>
                        <FormField label={server.auth === "token" ? "Access token" : "Password"} id="email-{server.kind}-secret" type="password" bind:value={server.secret} />
                    </fieldset>
                {/each}
            </div>
        </fieldset>
        <div class="flex flex-wrap gap-2">
            <SockethubButton buttonAction={connect} disabled={busy || connected || !address || !servers.some(server => server.host)}>Connect</SockethubButton>
            <SockethubButton variant="secondary" buttonAction={disconnect} disabled={busy || !connected}>Disconnect</SockethubButton>
        </div>
    </Step>
    <Step n={2} title="Fetch or watch messages" description="Fetch starts with the oldest messages. Watching receives new arrivals while connected. Up to 100 messages are shown here." locked={!receiving} lockedHint="Connect with an IMAP host to fetch mail.">
        <fieldset disabled={busy || !receiving || watching} class="space-y-3">
            <FormField label="From addresses (optional, comma-separated)" id="email-filter-from" bind:value={fromFilter} onInput={resetCursor} />
            <FormField label="To addresses (optional, comma-separated)" id="email-filter-to" bind:value={toFilter} onInput={resetCursor} />
            <div class="space-y-1.5">
                <label for="email-match" class="label">Match filters</label>
                <select id="email-match" bind:value={match} onchange={resetCursor} class="input sm:w-56">
                    <option value="any">From OR To</option><option value="all">From AND To</option>
                </select>
            </div>
        </fieldset>
        <FormField label="Fetch folders (comma-separated)" id="email-folders" bind:value={folders} onInput={resetCursor} />
        <div class="flex flex-wrap gap-2">
            <SockethubButton buttonAction={() => fetchMail()} disabled={busy || !receiving || !folders.trim()}>Fetch</SockethubButton>
            <SockethubButton variant="secondary" buttonAction={() => fetchMail(true)} disabled={busy || !receiving || !hasMore}>Fetch next</SockethubButton>
        </div>
        <FormField label="Folder to watch" id="email-watch-folder" bind:value={watchFolder} />
        <SockethubButton buttonAction={toggleWatch} disabled={busy || !receiving || !watchFolder}>{watching ? "Stop watching" : "Watch new messages"}</SockethubButton>
        {#each messages as message (message.id)}
            <article class="space-y-2 rounded-lg border border-zinc-200 p-4">
                <h3 class="font-semibold text-zinc-900">{message.subject || "(No subject)"}</h3>
                <p class="text-sm text-zinc-600">{message.from?.map(item => item.name ? `${item.name} <${item.address}>` : item.address).join(", ")} → {message.to?.map(item => item.address).join(", ")} · {message.folder}</p>
                {#if message.attachments?.length}
                    <ul class="text-sm list-disc pl-5" aria-label="Attachments">
                        {#each message.attachments as attachment, index (index)}
                            <li>{attachment.filename || "Unnamed attachment"} ({attachment.contentType})</li>
                        {/each}
                    </ul>
                {/if}
                {#if message.bodyOmitted}<p class="text-sm">Body omitted because this message exceeds the size limit.</p>{:else}<pre class="font-sans whitespace-pre-wrap break-words text-sm text-zinc-700">{message.content || "(No plain-text body)"}</pre>{/if}
            </article>
        {/each}
    </Step>
    <Step n={3} title="Send a message" description="Sends a send activity through your SMTP server." locked={!sending} lockedHint="Connect with an SMTP host to send mail.">
        <FormField label="To (comma-separated)" id="email-recipients" bind:value={recipients} />
        <FormField label="Subject" id="email-subject" bind:value={subject} />
        <div class="space-y-1.5">
            <label for="email-body" class="label">Message</label>
            <textarea id="email-body" bind:value={content} rows="6" class="input"></textarea>
        </div>
        <SockethubButton buttonAction={sendMail} disabled={busy || !sending || !recipients.trim() || !content}>Send</SockethubButton>
    </Step>
    {#if error}<div role="alert" class="callout callout-error">{error}</div>{/if}
    {#if status}<div role="status" class="callout callout-success">{status}</div>{/if}
</BaseExample>
