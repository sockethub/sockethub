<script lang="ts">
import { onMount } from "svelte";
import BaseExample from "$components/BaseExample.svelte";
import FormField from "$components/FormField.svelte";
import SockethubButton from "$components/SockethubButton.svelte";
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
    from?: { address?: string }[];
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
const actor = () => ({ id: address, type: "person" });

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
    if (message.type === "disconnect") {
        connected = false;
        watching = false;
    }
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
        await request("connect");
        connected = true;
        status = "Connected. Fetch messages or start watching a folder.";
    });
}
async function disconnect() {
    await perform(async () => {
        await request("disconnect");
        connected = false;
        watching = false;
        sc.clearCredentials();
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
onMount(() => {
    let active = true;
    const connectionLost = () => {
        connected = false;
        watching = false;
        status =
            "Sockethub connection lost. Reconnect before fetching or watching again.";
    };
    void ensureClientReady().then(
        () => {
            if (active) {
                sc.socket.on("message", receive);
                sc.socket.on("disconnect", connectionLost);
            }
        },
        (failure) => {
            if (active) error = String(failure);
        },
    );
    return () => {
        active = false;
        sc?.socket.off("message", receive);
        sc?.socket.off("disconnect", connectionLost);
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
            sc.clearCredentials();
        }
    };
});
</script>

<BaseExample title="Email Platform Example" description="Fetch and watch messages with IMAP, and send through SMTP. Messages remain on your mail server.">
    <section class="space-y-4">
        <h2 class="text-xl font-semibold">1. Connect your account</h2>
        <p class="text-sm text-gray-600">Configure receiving, sending, or both. Leave a server host blank to disable it. Use an app password or an OAuth access token.</p>
        <fieldset disabled={connected || busy} class="space-y-4">
            <FormField label="Your email address" id="email-address" type="email" bind:value={address} />
            <div class="grid gap-6 md:grid-cols-2">
                {#each servers as server (server.kind)}
                    <fieldset class="space-y-3 border rounded-lg p-4">
                        <legend class="font-semibold">{server.label}</legend>
                        <FormField label="Host" id="email-{server.kind}-host" bind:value={server.host} />
                        <FormField label="Port" id="email-{server.kind}-port" type="number" bind:value={server.port} />
                        <label class="flex gap-2"><input type="checkbox" bind:checked={server.secure} /> TLS from connection start</label>
                        <p class="text-xs text-gray-600">When unchecked, STARTTLS is required.</p>
                        <FormField label="Username" id="email-{server.kind}-username" bind:value={server.username} />
                        <label for="email-{server.kind}-auth" class="block text-sm font-semibold">Authentication</label>
                        <select id="email-{server.kind}-auth" bind:value={server.auth} class="border rounded p-2 w-full">
                            <option value="password">Password / app password</option><option value="token">OAuth access token</option>
                        </select>
                        <FormField label={server.auth === "token" ? "Access token" : "Password"} id="email-{server.kind}-secret" type="password" bind:value={server.secret} />
                    </fieldset>
                {/each}
            </div>
        </fieldset>
        <div class="flex gap-3">
            <SockethubButton buttonAction={connect} disabled={busy || connected || !address || !servers.some(server => server.host)}>Connect</SockethubButton>
            <SockethubButton buttonAction={disconnect} disabled={busy || !connected}>Disconnect</SockethubButton>
        </div>
    </section>
    <section class="space-y-4 border-t pt-6">
        <h2 class="text-xl font-semibold">2. Fetch or watch messages</h2>
        <fieldset disabled={busy || !receiving || watching} class="space-y-3">
            <FormField label="From addresses (optional, comma-separated)" id="email-filter-from" bind:value={fromFilter} onInput={resetCursor} />
            <FormField label="To addresses (optional, comma-separated)" id="email-filter-to" bind:value={toFilter} onInput={resetCursor} />
            <label for="email-match" class="block text-sm font-semibold">Match filters</label>
            <select id="email-match" bind:value={match} onchange={resetCursor} class="border rounded p-2">
                <option value="any">From OR To</option><option value="all">From AND To</option>
            </select>
        </fieldset>
        <FormField label="Fetch folders (comma-separated)" id="email-folders" bind:value={folders} onInput={resetCursor} />
        <div class="flex gap-3">
            <SockethubButton buttonAction={() => fetchMail()} disabled={busy || !receiving || !folders.trim()}>Fetch</SockethubButton>
            <SockethubButton buttonAction={() => fetchMail(true)} disabled={busy || !receiving || !hasMore}>Fetch next</SockethubButton>
        </div>
        <FormField label="Folder to watch" id="email-watch-folder" bind:value={watchFolder} />
        <SockethubButton buttonAction={toggleWatch} disabled={busy || !receiving || !watchFolder}>{watching ? "Stop watching" : "Watch new messages"}</SockethubButton>
        <p class="text-sm text-gray-600">Fetch starts with the oldest messages. Watching receives new arrivals while connected. Only the latest 100 fetched or received messages are displayed here.</p>
        {#each messages as message (message.id)}
            <article class="border rounded-lg p-4 space-y-2">
                <h3 class="font-semibold">{message.subject || "(No subject)"}</h3>
                <p class="text-sm text-gray-600">{message.from?.map(item => item.address).join(", ")} → {message.to?.map(item => item.address).join(", ")} · {message.folder}</p>
                {#if message.bodyOmitted}<p class="text-sm">Body omitted because this message exceeds the size limit.</p>{:else}<pre class="whitespace-pre-wrap break-words text-sm">{message.content || "(No plain-text body)"}</pre>{/if}
            </article>
        {/each}
    </section>
    <section class="space-y-4 border-t pt-6">
        <h2 class="text-xl font-semibold">3. Send a message</h2>
        <FormField label="To (comma-separated)" id="email-recipients" bind:value={recipients} />
        <FormField label="Subject" id="email-subject" bind:value={subject} />
        <label for="email-body" class="block text-sm font-semibold">Message</label>
        <textarea id="email-body" bind:value={content} rows="6" class="w-full border rounded-lg p-3"></textarea>
        <SockethubButton buttonAction={sendMail} disabled={busy || !sending || !recipients.trim() || !content}>Send</SockethubButton>
    </section>
    {#if error}<div role="alert" class="border border-red-200 bg-red-50 rounded p-4 text-red-800">{error}</div>{/if}
    {#if status}<div role="status" class="border border-green-200 bg-green-50 rounded p-4 text-green-800">{status}</div>{/if}
</BaseExample>
