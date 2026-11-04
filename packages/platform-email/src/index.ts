import type {
    ActivityStream,
    Logger,
    PersistentPlatformConfig,
    PersistentPlatformInterface,
    PlatformCallback,
    PlatformSession,
} from "@sockethub/schemas";
import { buildCanonicalContext } from "@sockethub/schemas";
import {
    ImapFlow,
    type ImapFlowOptions,
    type MessageEnvelopeObject,
    type SearchObject,
} from "imapflow";
import { simpleParser } from "mailparser";
import { createTransport, type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { mailHost } from "./net.js";
import { PlatformEmailSchema } from "./schema.js";
import type {
    Cursor,
    EmailCredentials,
    EmailJob,
    FetchOptions,
    Filter,
    SendOptions,
    WatchOptions,
} from "./types.js";

export type {
    Cursor,
    EmailCredentials,
    FetchOptions,
    Filter,
    SendOptions,
    WatchOptions,
} from "./types.js";

const CONTEXT = buildCanonicalContext(PlatformEmailSchema.contextUrl);
const MAX_MESSAGE_BYTES = 256 * 1024;
const MAX_BATCH_BYTES = 512 * 1024;
const SCAN_WINDOW = 500;
interface Watch {
    options: WatchOptions;
    folder: string;
    cursor: Cursor;
    actor: ActivityStream["actor"];
}
interface Dependencies {
    imap(options: ImapFlowOptions): ImapFlow;
    smtp(
        options: SMTPTransport.Options,
    ): Transporter<SMTPTransport.SentMessageInfo>;
}

export function matchesAddresses(
    envelope: MessageEnvelopeObject,
    filter: Filter,
): boolean {
    const checks: boolean[] = [];
    for (const field of ["from", "to"] as const) {
        const requested = filter[field];
        if (requested?.length) {
            const actual = new Set(
                (envelope[field] ?? []).map(({ address }) =>
                    address?.toLowerCase(),
                ),
            );
            checks.push(
                requested.some((address) => actual.has(address.toLowerCase())),
            );
        }
    }
    return (
        !checks.length ||
        (filter.match === "all" ? checks.every(Boolean) : checks.some(Boolean))
    );
}

export default class Email implements PersistentPlatformInterface {
    credentialsHash: string | undefined;
    config: PersistentPlatformConfig = {
        persist: true,
        shareConnections: false,
        retryStalledJobs: false,
        requireCredentials: ["connect", "send"],
        connectTimeoutMs: 30_000,
        allowPrivateAddresses: false,
    };
    private readonly log: Logger;
    private readonly sendToClient: PlatformSession["sendToClient"];
    private client?: ImapFlow;
    private initialized = false;
    private connecting?: Promise<void>;
    private chain: Promise<void> = Promise.resolve();
    private watching?: Watch;
    private draining = false;
    private drainAgain = false;
    private closed = false;
    private disposed = false;

    constructor(
        session: PlatformSession,
        private readonly dependencies: Dependencies = {
            imap: (options) => new ImapFlow(options),
            smtp: (options) => createTransport(options),
        },
    ) {
        this.log = session.log;
        this.sendToClient = session.sendToClient;
    }
    get schema() {
        return PlatformEmailSchema;
    }
    isInitialized(): boolean {
        return this.initialized;
    }

    private failure(error: unknown, action: string): Error {
        this.log.warn("email operation failed", { action });
        return new Error(
            error instanceof Error && error.message.startsWith("email:")
                ? error.message
                : `email:${action}-failed`,
        );
    }
    private run(
        action: string,
        done: PlatformCallback,
        operation: () => Promise<ActivityStream | undefined>,
    ): void {
        const task = this.chain.then(() => {
            if (this.disposed) throw new Error("email:closed");
            return operation();
        });
        this.chain = task.then(
            () => {},
            () => {},
        );
        task.then(
            (result) => done(undefined, result),
            (error) => done(this.failure(error, action)),
        );
    }
    connect(
        job: ActivityStream,
        credentials: EmailCredentials,
        done: PlatformCallback,
    ): void {
        this.run("connect", done, async () => {
            if (!this.initialized) {
                this.connecting ??= this.open(credentials, job.actor).finally(
                    () => {
                        this.connecting = undefined;
                    },
                );
                await this.connecting;
            }
            return {
                ...job,
                object: {
                    type: "connection",
                    receiving: !!this.client,
                    sending: !!credentials.object.smtp,
                },
            };
        });
    }
    private async open(
        credentials: EmailCredentials,
        actor: ActivityStream["actor"],
    ): Promise<void> {
        this.closed = false;
        const server = credentials.object.imap;
        if (server) {
            const host = await mailHost(
                server.host,
                this.config.allowPrivateAddresses === true,
            );
            if (this.closed) throw new Error("email:connection-closed");
            const secure = server.secure !== false;
            const client = this.dependencies.imap({
                host,
                port: server.port ?? (secure ? 993 : 143),
                secure,
                ...(secure ? {} : { doSTARTTLS: true }),
                servername: server.host,
                tls: { servername: server.host, rejectUnauthorized: true },
                auth: {
                    user: server.username,
                    ...(server.token
                        ? { accessToken: server.token }
                        : { pass: server.password }),
                },
                logger: false,
                disableCompression: true,
                maxLiteralSize: MAX_MESSAGE_BYTES + 1,
                maxResponseSize: MAX_MESSAGE_BYTES * 2,
                maxIdleTime: 5 * 60_000,
                connectionTimeout: this.config.connectTimeoutMs,
                greetingTimeout: this.config.connectTimeoutMs,
                socketTimeout: 10 * 60_000,
            });
            this.client = client;
            client.on("error", () => {
                this.log.warn("email IMAP connection error", {
                    actor: actor.id,
                });
            });
            client.on("close", () => {
                if (this.client !== client) return;
                this.client = undefined;
                this.initialized = false;
                this.watching = undefined;
                if (!this.closed)
                    this.sendToClient({
                        "@context": CONTEXT,
                        type: "disconnect",
                        actor,
                        error: "email:connection-closed; reconnect and fetch using your cursor",
                    });
            });
            client.on("exists", () => this.drain());
            try {
                await client.connect();
                if (this.closed || this.client !== client || !client.usable)
                    throw new Error("email:connection-closed");
            } catch (error) {
                this.client = undefined;
                client.close();
                throw error;
            }
        }
        this.initialized = true;
    }
    fetch(job: EmailJob<FetchOptions>, done: PlatformCallback): void {
        this.run("fetch", done, async () => {
            const client = this.imap();
            const options: FetchOptions = job.object ?? {};
            const items: ActivityStream[] = [];
            const cursors: Record<string, Cursor> = Object.create(null);
            let hasMore = false;
            let bytes = 0;
            try {
                for (const folder of options.folders ?? ["INBOX"]) {
                    const lock = await client.getMailboxLock(folder, {
                        readOnly: true,
                    });
                    try {
                        const batch = await this.batch(
                            folder,
                            options.cursors &&
                                Object.hasOwn(options.cursors, folder)
                                ? options.cursors[folder]
                                : undefined,
                            options,
                            job.actor,
                            (options.limit ?? 20) - items.length,
                            MAX_BATCH_BYTES - bytes,
                        );
                        items.push(...batch.items);
                        cursors[folder] = batch.cursor;
                        bytes += batch.bytes;
                        hasMore ||= batch.hasMore;
                        if (items.length >= (options.limit ?? 20)) {
                            hasMore ||=
                                folder !==
                                (options.folders ?? ["INBOX"]).at(-1);
                            break;
                        }
                    } finally {
                        lock.release();
                    }
                }
            } finally {
                if (this.watching) {
                    await client.mailboxOpen(this.watching.folder, {
                        readOnly: true,
                    });
                    this.drain();
                }
            }
            return {
                "@context": CONTEXT,
                id: job.id,
                type: "collection",
                actor: job.actor,
                summary: "Email messages",
                totalItems: items.length,
                items,
                cursors,
                hasMore,
            };
        });
    }
    private imap(): ImapFlow {
        if (!this.client?.usable) throw new Error("email:imap-not-connected");
        return this.client;
    }
    private async batch(
        folder: string,
        previous: Cursor | undefined,
        filter: Filter,
        actor: ActivityStream["actor"],
        limit: number,
        byteLimit: number,
    ) {
        const client = this.imap();
        if (!client.mailbox) throw new Error("email:mailbox-not-selected");
        // EXISTS updates message counts, but does not refresh ImapFlow's cached UIDNEXT.
        const mailbox = await client.status(folder, {
            uidNext: true,
            uidValidity: true,
        });
        if (
            !mailbox ||
            mailbox.uidNext === undefined ||
            mailbox.uidValidity === undefined
        ) {
            throw new Error("email:mailbox-status-unavailable");
        }
        const validity = String(mailbox.uidValidity);
        if (previous && previous.uidValidity !== validity)
            throw new Error(
                "email:cursor-invalid; fetch again without this folder's cursor",
            );
        const cursor = { uidValidity: validity, uid: previous?.uid ?? 0 };
        const end = Math.min(mailbox.uidNext - 1, cursor.uid + SCAN_WINDOW);
        const items: ActivityStream[] = [];
        let bytes = 0;
        if (end <= cursor.uid || limit <= 0)
            return { items, cursor, bytes, hasMore: end > cursor.uid };
        const query: SearchObject = { uid: `${cursor.uid + 1}:${end}` };
        // SEARCH is a coarse prefilter; parsed address equality below rejects substring matches.
        const terms: SearchObject[] = [
            ...(filter.from ?? []).map((from) => ({ from })),
            ...(filter.to ?? []).map((to) => ({ to })),
        ];
        if (terms.length === 1) Object.assign(query, terms[0]);
        else if (terms.length > 1) query.or = terms;
        const uids = await client.search(query, { uid: true });
        for (const uid of uids || []) {
            const metadata = await client.fetchOne(
                uid,
                { envelope: true, size: true },
                { uid: true },
            );
            if (
                !metadata ||
                !metadata.envelope ||
                !matchesAddresses(metadata.envelope, filter)
            ) {
                cursor.uid = uid;
                continue;
            }
            const oversized =
                (metadata.size ?? MAX_MESSAGE_BYTES + 1) > MAX_MESSAGE_BYTES;
            if (!oversized && bytes + (metadata.size ?? 0) > byteLimit) break;
            let content = "";
            let html: string | undefined;
            if (!oversized) {
                const message = await client.fetchOne(
                    uid,
                    { source: { start: 0, maxLength: MAX_MESSAGE_BYTES + 1 } },
                    { uid: true },
                );
                if (!message || !message.source)
                    throw new Error("email:message-disappeared; retry fetch");
                if (message.source.length > MAX_MESSAGE_BYTES)
                    throw new Error("email:message-too-large");
                bytes += message.source.length;
                const parsed = await simpleParser(message.source, {
                    skipHtmlToText: true,
                    skipTextToHtml: true,
                    skipImageLinks: true,
                });
                content = parsed.text ?? "";
                html = parsed.html || undefined;
            }
            const envelope = metadata.envelope;
            items.push({
                "@context": CONTEXT,
                type: "post",
                actor: {
                    id: envelope.from?.[0]?.address ?? "unknown",
                    type: "person",
                },
                target: actor,
                object: {
                    type: "message",
                    id: `email:${encodeURIComponent(actor.id)}:${encodeURIComponent(folder)}:${validity}:${uid}`,
                    folder,
                    uidValidity: validity,
                    uid,
                    from: envelope.from ?? [],
                    to: envelope.to ?? [],
                    cc: envelope.cc ?? [],
                    subject: envelope.subject ?? "",
                    messageId: envelope.messageId,
                    inReplyTo: envelope.inReplyTo,
                    published: envelope.date?.toISOString(),
                    content,
                    html,
                    bodyOmitted: oversized,
                },
            });
            cursor.uid = uid;
            if (items.length >= limit) break;
        }
        const last = (uids || []).at(-1);
        if (!last || cursor.uid >= last) cursor.uid = end;
        return {
            items,
            cursor,
            bytes,
            hasMore: cursor.uid < mailbox.uidNext - 1,
        };
    }
    watch(job: EmailJob<WatchOptions>, done: PlatformCallback): void {
        this.run("watch", done, async () => {
            const client = this.imap();
            const options: WatchOptions = job.object ?? {};
            const folder = options.folder ?? "INBOX";
            const previous = this.watching;
            this.watching = undefined;
            try {
                const mailbox = await client.mailboxOpen(folder, {
                    readOnly: true,
                });
                const cursor = options.cursor ?? {
                    uidValidity: String(mailbox.uidValidity),
                    uid: mailbox.uidNext - 1,
                };
                if (cursor.uidValidity !== String(mailbox.uidValidity))
                    throw new Error("email:cursor-invalid");
                this.watching = {
                    options,
                    folder,
                    cursor: { ...cursor },
                    actor: job.actor,
                };
                this.drain();
                return {
                    ...job,
                    object: { type: "subscription", folder, cursor },
                };
            } catch (error) {
                if (previous) {
                    await client.mailboxOpen(previous.folder, {
                        readOnly: true,
                    });
                    this.watching = previous;
                    this.drain();
                }
                throw error;
            }
        });
    }
    private drain(): void {
        if (!this.watching) return;
        if (this.draining) {
            this.drainAgain = true;
            return;
        }
        this.drainAgain = false;
        this.draining = true;
        const task = this.chain.then(async () => {
            const watch = this.watching;
            if (!watch) return;
            const client = this.imap();
            const lock = await client.getMailboxLock(watch.folder, {
                readOnly: true,
            });
            try {
                const result = await this.batch(
                    watch.folder,
                    watch.cursor,
                    watch.options,
                    watch.actor,
                    20,
                    MAX_BATCH_BYTES,
                );
                for (const item of result.items) this.sendToClient(item);
                watch.cursor = result.cursor;
                this.sendToClient({
                    "@context": CONTEXT,
                    type: "watch",
                    actor: watch.actor,
                    object: {
                        type: "subscription",
                        folder: watch.folder,
                        cursor: watch.cursor,
                    },
                });
                return result.hasMore;
            } finally {
                lock.release();
            }
        });
        this.chain = task.then(
            () => {},
            () => {},
        );
        task.then(
            (more) => {
                this.draining = false;
                if (more || this.drainAgain) this.drain();
            },
            (error) => {
                this.draining = false;
                const watch = this.watching;
                this.watching = undefined;
                if (watch)
                    this.sendToClient({
                        "@context": CONTEXT,
                        type: "watch",
                        actor: watch.actor,
                        error: this.failure(error, "watch").message,
                    });
            },
        );
    }
    unwatch(job: ActivityStream, done: PlatformCallback): void {
        this.run("unwatch", done, async () => {
            this.watching = undefined;
            return job;
        });
    }
    send(
        job: EmailJob<SendOptions>,
        credentials: EmailCredentials,
        done: PlatformCallback,
    ): void {
        this.run("send", done, async () => {
            const server = credentials.object.smtp;
            if (!server) throw new Error("email:smtp-not-configured");
            const host = await mailHost(
                server.host,
                this.config.allowPrivateAddresses === true,
            );
            const secure =
                server.secure === true ||
                (server.secure === undefined && server.port === 465);
            const transport = this.dependencies.smtp({
                host,
                port: server.port ?? (secure ? 465 : 587),
                secure,
                requireTLS: !secure,
                tls: { servername: server.host, rejectUnauthorized: true },
                auth: server.token
                    ? {
                          type: "OAuth2",
                          user: server.username,
                          accessToken: server.token,
                      }
                    : { user: server.username, pass: server.password },
                connectionTimeout: this.config.connectTimeoutMs,
                greetingTimeout: this.config.connectTimeoutMs,
                socketTimeout: 60_000,
                logger: false,
                debug: false,
                disableFileAccess: true,
                disableUrlAccess: true,
            });
            const message = job.object as SendOptions;
            try {
                const result = await transport.sendMail({
                    from: { address: credentials.object.from, name: "" },
                    to: message.to.map((address) => ({ address, name: "" })),
                    cc: message.cc?.map((address) => ({ address, name: "" })),
                    bcc: message.bcc?.map((address) => ({ address, name: "" })),
                    subject: message.subject,
                    text: message.content,
                    html: message.html,
                    inReplyTo: message.inReplyTo,
                    references: message.references,
                });
                return {
                    "@context": CONTEXT,
                    id: job.id,
                    type: "send",
                    actor: job.actor,
                    object: {
                        type: "submission",
                        messageId: result.messageId,
                        accepted: result.accepted,
                        rejected: result.rejected,
                        status: "accepted-by-server",
                    },
                };
            } catch {
                throw new Error(
                    "email:submission-failed-or-uncertain; do not automatically retry",
                );
            } finally {
                transport.close();
            }
        });
    }
    disconnect(job: ActivityStream, done: PlatformCallback): void {
        this.run("disconnect", done, async () => {
            this.close();
            return job;
        });
    }
    private close(): void {
        this.closed = true;
        this.watching = undefined;
        this.initialized = false;
        const client = this.client;
        this.client = undefined;
        client?.close();
    }
    cleanup(done: PlatformCallback): void {
        this.disposed = true;
        this.close();
        done();
    }
}
