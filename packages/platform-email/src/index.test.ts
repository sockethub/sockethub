import { describe, expect, it, mock } from "bun:test";
import { EventEmitter, once } from "node:events";
import type { ActivityStream, PlatformCallback, PlatformSession } from "@sockethub/schemas";
import type { FetchMessageObject, ImapFlow, ImapFlowOptions, SearchObject } from "imapflow";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import Email, { attachmentMetadata, matchesAddresses } from "./index.js";
import { mailHost } from "./net.js";
import type { EmailCredentials } from "./types.js";

const actor = { id: "me@example.com", type: "person" };
const credentials: EmailCredentials = {
    "@context": [], type: "credentials", actor,
    object: { type: "credentials", from: actor.id,
        imap: { host: "8.8.8.8", username: actor.id, password: "test-password" },
        smtp: { host: "8.8.8.8", username: actor.id, token: "test-token" } },
};
function job(type: string, object?: Record<string, unknown>): ActivityStream {
    return { "@context": [], type, actor, ...(object ? { object: { type: "message", ...object } } : {}) };
}
function call(invoke: (done: PlatformCallback) => void): Promise<ActivityStream> {
    return new Promise((resolve, reject) => invoke((error, result) => error ? reject(error) : resolve(result as ActivityStream)));
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
    const messages = new Map<number, Partial<FetchMessageObject>>();
    const mailboxes = new Map([ ["INBOX", { uidValidity: 7n, uidNext: 1 }], ["Orders", { uidValidity: 8n, uidNext: 1 }] ]);
    const client = Object.assign(new EventEmitter(), {
        usable: true, mailbox: mailboxes.get("INBOX")!,
        connect: mock(async () => {}), close: mock(() => {}),
        mailboxOpen: mock(async (folder: string) => {
            const mailbox = mailboxes.get(folder);
            if (!mailbox) throw new Error("no such mailbox");
            client.mailbox = mailbox;
            return mailbox;
        }),
        getMailboxLock: mock(async (folder: string) => {
            await client.mailboxOpen(folder);
            return { release: mock(() => {}) };
        }),
        search: mock(async (query: SearchObject) => {
            const [start, end] = String(query.uid).split(":").map(Number);
            return [...messages.keys()].filter(uid => uid >= start && uid <= end);
        }),
        fetchOne: mock(async (uid: number) => messages.get(uid) ?? false),
        status: mock(async (folder: string) => ({ ...mailboxes.get(folder) })),
    });
    const sendMail = mock(async (_options: unknown) => ({ messageId: "<sent@example.com>", accepted: ["friend@example.com"], rejected: ["bad@example.com"] }));
    const transport = { sendMail, close: mock(() => {}) };
    let imapOptions: ImapFlowOptions | undefined;
    let smtpOptions: SMTPTransport.Options | undefined;
    const sent: ActivityStream[] = [];
    const output = new EventEmitter();
    const session: PlatformSession = {
        log: { debug() {}, info() {}, warn() {}, error() {} },
        sendToClient: message => { sent.push(message); output.emit(message.type, message); }, updateActor: async () => {},
    };
    const platform = new Email(session, {
        imap: options => { imapOptions = options; return client as unknown as ImapFlow; },
        smtp: options => { smtpOptions = options; return transport as unknown as Transporter<SMTPTransport.SentMessageInfo>; },
    });
    function add(uid: number, from = "friend@example.com", to = actor.id, content = "Hello") {
        const source = Buffer.from(`From: ${from}\r\nTo: ${to}\r\nSubject: Test\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${content}`);
        messages.set(uid, { uid, size: source.length, source,
            envelope: { from: [{ address: from }], to: [{ address: to }], subject: "Test", messageId: `<${uid}@example.com>` } });
        client.mailbox.uidNext = uid + 1;
    }
    return { platform, client, messages, mailboxes, transport, sent, output, add, get imapOptions() { return imapOptions; }, get smtpOptions() { return smtpOptions; } };
}

describe("email platform", () => {
    it("matches exact parsed addresses with explicit any/all semantics", () => {
        const envelope = { from: [{ address: "Friend@example.com" }], to: [{ address: actor.id }] };
        expect(matchesAddresses(envelope, { from: ["friend@example.com"] })).toBeTrue();
        expect(matchesAddresses(envelope, { from: ["end@example.com"] })).toBeFalse();
        expect(matchesAddresses(envelope, { from: ["other@example.com"], to: [actor.id] })).toBeTrue();
        expect(matchesAddresses(envelope, { from: ["other@example.com"], to: [actor.id], match: "all" })).toBeFalse();
    });
    it("lists nested and named inline attachments without exposing content", () => {
        expect(attachmentMetadata({ type: "multipart/mixed", childNodes: [
            { type: "text/plain" },
            { type: "multipart/related", childNodes: [
                { type: "image/png", disposition: "inline", parameters: { name: "logo.png" } },
                { type: "application/pdf", disposition: "attachment", dispositionParameters: { filename: "résumé.pdf" } },
                { type: "application/octet-stream", disposition: "attachment" },
            ] },
        ] })).toEqual([
            { filename: "logo.png", contentType: "image/png" },
            { filename: "résumé.pdf", contentType: "application/pdf" },
            { contentType: "application/octet-stream" },
        ]);
        expect(attachmentMetadata()).toEqual([]);
    });
    it("preserves References and the sender name on received messages", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        s.add(1);
        const message = s.messages.get(1)!;
        message.envelope!.from![0].name = "Friend Example";
        message.source = Buffer.concat([Buffer.from("References: <root@example.com>\r\n <parent@example.com>\r\n"), message.source!]);
        message.size = message.source.length;
        const result = await call(done => s.platform.fetch(job("fetch"), done)) as ActivityStream & { items: ActivityStream[] };
        expect(result.items[0].object?.references).toEqual(["<root@example.com>", "<parent@example.com>"]);
        expect(result.items[0].actor.name).toBe("Friend Example");
    });
    it("preserves reference and attachment metadata when the body is omitted", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        s.add(1);
        const message = s.messages.get(1)!;
        message.size = 300000;
        message.headers = Buffer.from("References: <root@example.com>\r\n\r\n");
        message.bodyStructure = { type: "application/pdf", disposition: "attachment", dispositionParameters: { filename: "report.pdf" } };
        const result = await call(done => s.platform.fetch(job("fetch"), done)) as ActivityStream & { items: ActivityStream[] };
        expect(result.items[0].object).toMatchObject({ bodyOmitted: true, content: "", references: ["<root@example.com>"], attachments: [{ filename: "report.pdf", contentType: "application/pdf" }] });
        expect(s.client.fetchOne).toHaveBeenCalledTimes(1);
        expect(s.client.fetchOne).toHaveBeenCalledWith(1, { envelope: true, size: true, bodyStructure: true, headers: ["references"] }, { uid: true });
    });
    it("uses the ActivityStreams actor name when sending", async () => {
        const s = setup();
        const request = { ...job("send", { to: ["friend@example.com"], content: "Hi" }), actor: { ...actor, name: "Doe, Jane" } };
        await call(done => s.platform.send(request as never, credentials, done));
        expect(s.transport.sendMail.mock.calls[0][0]).toMatchObject({ from: { address: actor.id, name: "Doe, Jane" } });
    });
    it("connects once, requires TLS, and closes resources", async () => {
        const s = setup();
        await Promise.all([call(done => s.platform.connect(job("connect"), credentials, done)), call(done => s.platform.connect(job("connect"), credentials, done))]);
        expect(s.client.connect).toHaveBeenCalledTimes(1);
        expect(s.platform.isInitialized()).toBeTrue();
        expect(s.platform.config.shareConnections).toBeFalse();
        expect(s.platform.config.retryStalledJobs).toBeFalse();
        expect(s.imapOptions?.logger).toBeFalse();
        expect(s.imapOptions?.tls?.rejectUnauthorized).toBeTrue();
        await call(done => s.platform.disconnect(job("disconnect"), done));
        expect(s.client.close).toHaveBeenCalledTimes(1);
        expect(s.platform.isInitialized()).toBeFalse();
    });
    it("propagates connection failure without exposing provider errors", async () => {
        const s = setup();
        s.client.connect.mockImplementation(async () => { throw new Error("secret provider error"); });
        await expect(call(done => s.platform.connect(job("connect"), credentials, done))).rejects.toThrow("email:connect-failed");
        expect(s.client.close).toHaveBeenCalledTimes(1);
        expect(s.platform.isInitialized()).toBeFalse();
    });
    it("requires STARTTLS when implicit TLS is disabled", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), { ...credentials, object: { ...credentials.object, imap: { ...credentials.object.imap!, secure: false } } }, done));
        expect(s.imapOptions?.doSTARTTLS).toBeTrue();
    });
    it("fetches filtered bodies and resumes without repeating messages", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        s.add(1, "other@example.com"); s.add(2); s.add(3);
        const first = await call(done => s.platform.fetch(job("fetch", { from: ["friend@example.com"], limit: 1 }), done)) as ActivityStream & { items: ActivityStream[]; cursors: unknown; hasMore: boolean };
        expect(first.items).toHaveLength(1);
        expect(first.items[0].object?.uid).toBe(2);
        expect(first.items[0].object?.content).toBe("Hello");
        expect(first.hasMore).toBeTrue();
        const next = await call(done => s.platform.fetch(job("fetch", { cursors: first.cursors }), done)) as typeof first;
        expect(next.items).toHaveLength(1);
        expect(next.items[0].object?.uid).toBe(3);
        expect(next.hasMore).toBeFalse();
    });
    it("fetches specified folders and rejects stale mailbox cursors", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        const result = await call(done => s.platform.fetch(job("fetch", { folders: ["INBOX", "Orders"] }), done));
        expect(result.type).toBe("collection");
        expect(s.client.mailboxOpen.mock.calls.map(call => call[0])).toEqual(["INBOX", "Orders"]);
        await expect(call(done => s.platform.fetch(job("fetch", { cursors: { INBOX: { uidValidity: "6", uid: 1 } } }), done))).rejects.toThrow("email:cursor-invalid");
    });
    it("paginates mailbox names that collide with Object prototype properties", async () => {
        const s = setup();
        s.mailboxes.set("__proto__", { uidValidity: 11n, uidNext: 1 });
        s.mailboxes.set("constructor", { uidValidity: 12n, uidNext: 1 });
        await call(done => s.platform.connect(job("connect"), credentials, done));
        const result = await call(done => s.platform.fetch(job("fetch", { folders: ["__proto__", "constructor"], cursors: {} }), done)) as ActivityStream & { cursors: unknown };
        const cursors = JSON.parse(JSON.stringify(result.cursors));
        expect(Object.keys(cursors)).toEqual(["__proto__", "constructor"]);
        expect(cursors.__proto__).toEqual({ uidValidity: "11", uid: 0 });
        expect(cursors.constructor).toEqual({ uidValidity: "12", uid: 0 });
        const next = await call(done => s.platform.fetch(job("fetch", { folders: ["__proto__", "constructor"], cursors }), done));
        expect(next.type).toBe("collection");
    });
    it("fetches arrivals even when the selected mailbox has a stale UIDNEXT", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        s.add(1);
        s.client.mailbox = { uidValidity: 7n, uidNext: 1 };
        s.client.getMailboxLock.mockImplementation(async () => ({ release: mock(() => {}) }));
        const result = await call(done => s.platform.fetch(job("fetch"), done)) as ActivityStream & { items: ActivityStream[] };
        expect(result.items.map(item => item.object?.uid)).toEqual([1]);
        expect(s.client.status).toHaveBeenCalledWith("INBOX", { uidNext: true, uidValidity: true });
    });
    it("rejects changed UIDVALIDITY even when the selected mailbox cache is unchanged", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        s.mailboxes.set("INBOX", { uidValidity: 9n, uidNext: 1 });
        s.client.getMailboxLock.mockImplementation(async () => ({ release: mock(() => {}) }));
        await expect(call(done => s.platform.fetch(job("fetch", { cursors: { INBOX: { uidValidity: "7", uid: 0 } } }), done))).rejects.toThrow("email:cursor-invalid");
    });
    it("returns oversized messages as metadata without transferring their body", async () => {
        const s = setup(); await call(done => s.platform.connect(job("connect"), credentials, done));
        s.add(1); s.messages.get(1)!.size = 300000;
        const result = await call(done => s.platform.fetch(job("fetch"), done)) as ActivityStream & { items: ActivityStream[] };
        expect(result.items[0].object?.bodyOmitted).toBeTrue();
        expect(s.client.fetchOne).toHaveBeenCalledTimes(1);
    });
    it("watches only new matching messages, restores the watched folder, and stops on unwatch", async () => {
        const s = setup(); await call(done => s.platform.connect(job("connect"), credentials, done));
        s.add(1);
        await call(done => s.platform.watch(job("watch", { from: ["friend@example.com"] }), done));
        await tick();
        const incoming = once(s.output, "post");
        s.add(2, "other@example.com"); s.add(3); s.client.emit("exists");
        await incoming;
        expect(s.sent.filter(message => message.type === "post").map(message => message.object?.uid)).toEqual([3]);
        await call(done => s.platform.fetch(job("fetch", { folders: ["Orders"] }), done));
        expect(s.client.mailbox).toBe(s.mailboxes.get("INBOX")!);
        await call(done => s.platform.unwatch(job("unwatch"), done));
        s.add(4); s.client.emit("exists"); await tick();
        expect(s.sent.filter(message => message.type === "post")).toHaveLength(1);
    });
    it("notifies clients on connection loss and requires explicit reconnect", async () => {
        const s = setup(); await call(done => s.platform.connect(job("connect"), credentials, done));
        s.client.emit("error", new Error("network failed")); s.client.emit("close");
        expect(s.platform.isInitialized()).toBeFalse();
        expect(s.sent.at(-1)?.error).toContain("email:connection-closed");
        await expect(call(done => s.platform.fetch(job("fetch"), done))).rejects.toThrow("email:imap-not-connected");
    });
    it("supports SMTP-only accounts and returns partial recipient acceptance", async () => {
        const s = setup();
        const smtpOnly = { ...credentials, object: { ...credentials.object, imap: undefined } };
        await call(done => s.platform.connect(job("connect"), smtpOnly, done));
        const result = await call(done => s.platform.send(job("send", { to: ["friend@example.com", "bad@example.com"], content: "Hi", inReplyTo: "<original@example.com>" }) as never, smtpOnly, done));
        expect(result.object?.accepted).toEqual(["friend@example.com"]);
        expect(result.object?.rejected).toEqual(["bad@example.com"]);
        expect(s.smtpOptions?.requireTLS).toBeTrue();
        expect(s.smtpOptions?.auth).toMatchObject({ type: "OAuth2", accessToken: "test-token" });
        expect(s.transport.close).toHaveBeenCalledTimes(1);
    });
    it("reports uncertain submission failures and never retries", async () => {
        const s = setup();
        s.transport.sendMail.mockImplementation(async () => { throw new Error("socket lost"); });
        await expect(call(done => s.platform.send(job("send", { to: [actor.id], content: "Hi" }) as never, credentials, done))).rejects.toThrow("email:submission-failed-or-uncertain");
        expect(s.transport.sendMail).toHaveBeenCalledTimes(1);
        expect(s.transport.close).toHaveBeenCalledTimes(1);
    });
    it("fails a fetch instead of skipping messages when IMAP search fails", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        s.add(1); s.add(2);
        s.client.search.mockImplementation(async () => false);
        await expect(call(done => s.platform.fetch(job("fetch"), done))).rejects.toThrow("email:search-failed");
        s.client.search.mockImplementation(async (query: SearchObject) => {
            const [start, end] = String(query.uid).split(":").map(Number);
            return [...s.messages.keys()].filter(uid => uid >= start && uid <= end);
        });
        const result = await call(done => s.platform.fetch(job("fetch"), done)) as ActivityStream & { items: ActivityStream[] };
        expect(result.items.map(item => item.object?.uid)).toEqual([1, 2]);
    });
    it("stops a watch instead of advancing past messages when IMAP search fails", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        await call(done => s.platform.watch(job("watch"), done));
        const started = await once(s.output, "watch");
        expect(started[0].error).toBeUndefined();
        s.client.search.mockImplementation(async () => false);
        const failed = once(s.output, "watch");
        s.add(1);
        s.client.emit("exists");
        const message = (await failed)[0];
        expect(message.error).toContain("email:search-failed");
        expect(s.sent.filter(entry => entry.type === "post")).toHaveLength(0);
        expect(message.object?.cursor).toBeUndefined();
    });
    it("advances cursors through empty filtered windows", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        s.client.mailbox.uidNext = 1001;
        const result = await call(done => s.platform.fetch(job("fetch", { from: ["nobody@example.com"] }), done)) as ActivityStream & { cursors: Record<string, { uid: number }>; hasMore: boolean };
        expect(result.cursors.INBOX.uid).toBe(500);
        expect(result.hasMore).toBeTrue();
    });
    it("rejects a stale watch cursor and propagates missing SMTP configuration", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        await expect(call(done => s.platform.watch(job("watch", { cursor: { uidValidity: "6", uid: 0 } }), done))).rejects.toThrow("email:cursor-invalid");
        await expect(call(done => s.platform.send(job("send", { to: [actor.id], content: "Hi" }) as never, { ...credentials, object: { ...credentials.object, smtp: undefined } }, done))).rejects.toThrow("email:smtp-not-configured");
    });
    it("restores an existing watch when a replacement cursor is invalid", async () => {
        const s = setup();
        await call(done => s.platform.connect(job("connect"), credentials, done));
        await call(done => s.platform.watch(job("watch"), done));
        await expect(call(done => s.platform.watch(job("watch", { folder: "Orders", cursor: { uidValidity: "wrong", uid: 0 } }), done))).rejects.toThrow("email:cursor-invalid");
        expect(s.client.mailbox).toBe(s.mailboxes.get("INBOX")!);
        const incoming = once(s.output, "post");
        s.add(1); s.client.emit("exists");
        await incoming;
        expect(s.sent.find(message => message.type === "post")?.object?.folder).toBe("INBOX");
    });
    it("does not revive an IMAP connection when cleanup interrupts connect", async () => {
        const s = setup();
        let finish: () => void = () => {};
        const waiting = new Promise<void>(resolve => { finish = resolve; });
        s.client.connect.mockImplementation(() => waiting);
        const connected = call(done => s.platform.connect(job("connect"), credentials, done));
        await tick();
        s.platform.cleanup(() => {});
        finish();
        await expect(connected).rejects.toThrow("email:connection-closed");
        expect(s.platform.isInitialized()).toBeFalse();
    });
    it("blocks private and metadata servers unless explicitly allowed", async () => {
        for (const host of ["127.0.0.1", "169.254.169.254", "::1"]) {
            await expect(mailHost(host, false)).rejects.toThrow("email:blocked-server-address");
        }
        expect(await mailHost("127.0.0.1", true)).toBe("127.0.0.1");
    });
});
