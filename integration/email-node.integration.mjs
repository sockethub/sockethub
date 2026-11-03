// Local TLS protocol checks using the real IMAP/SMTP libraries and built platform.
// Requires Node >=20.19, openssl, and `bun run build`; no external mail account.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:tls";
import Email from "../packages/platform-email/dist/index.js";

const require = createRequire(
    new URL("../packages/platform-email/package.json", import.meta.url),
);
const { ImapFlow } = require("imapflow");
const { createTransport } = require("nodemailer");
const directory = mkdtempSync(join(tmpdir(), "sockethub-email-"));
const keyPath = join(directory, "key.pem");
const certPath = join(directory, "cert.pem");
execFileSync(
    "openssl",
    [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost",
        "-keyout",
        keyPath,
        "-out",
        certPath,
    ],
    { stdio: "ignore" },
);
const ca = readFileSync(certPath);
const tls = { key: readFileSync(keyPath), cert: ca };
const sockets = new Set();
const imapSockets = new Set();
const sources = [
    Buffer.from(
        "From: friend@example.com\r\nTo: me@example.com\r\nSubject: Real IMAP\r\nContent-Type: text/plain\r\n\r\nHello over TLS\r\n",
    ),
];
const submissions = [];
const events = new EventEmitter();
const commandTimeout = AbortSignal.timeout(15000);

function serve(greeting, handle) {
    const server = createServer(tls, (socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
        socket.on("error", () => {});
        socket.write(greeting);
        let input = "";
        socket.on("data", (bytes) => {
            input += bytes.toString();
            while (input.includes("\r\n")) {
                const end = input.indexOf("\r\n");
                const line = input.slice(0, end);
                input = input.slice(end + 2);
                handle(socket, line);
            }
        });
    });
    return server;
}
const idleTags = new Map();
const imap = serve(
    "* OK [CAPABILITY IMAP4rev1 AUTH=PLAIN SASL-IR IDLE] test\r\n",
    (socket, line) => {
        imapSockets.add(socket);
        if (line === "DONE") {
            socket.write(`${idleTags.get(socket)} OK idle complete\r\n`);
            idleTags.delete(socket);
            return;
        }
        const [, tag, rawCommand, rest = ""] =
            /^(\S+)\s+(\S+)(?:\s+(.*))?$/.exec(line) ?? [];
        const command = rawCommand?.toUpperCase();
        const ok = () => socket.write(`${tag} OK ${command} complete\r\n`);
        if (command === "CAPABILITY")
            socket.write("* CAPABILITY IMAP4rev1 AUTH=PLAIN SASL-IR IDLE\r\n");
        else if (command === "LIST" || command === "LSUB")
            socket.write(`* ${command} (\\HasNoChildren) "/" "INBOX"\r\n`);
        else if (command === "SELECT" || command === "EXAMINE") {
            socket.write(
                `* FLAGS (\\Seen)\r\n* ${sources.length} EXISTS\r\n* OK [UIDVALIDITY 7]\r\n* OK [UIDNEXT ${sources.length + 1}]\r\n`,
            );
        } else if (command === "UID" && rest.startsWith("SEARCH")) {
            const range = /UID (\d+)(?::(\d+))?/.exec(rest);
            const start = Number(range?.[1] ?? 1);
            const end = Number(range?.[2] ?? range?.[1] ?? sources.length);
            socket.write(
                `* SEARCH ${sources
                    .map((_, index) => index + 1)
                    .filter((uid) => uid >= start && uid <= end)
                    .join(" ")}\r\n`,
            );
        } else if (command === "UID" && rest.startsWith("FETCH")) {
            const uid = Number(/^FETCH (\d+)/.exec(rest)?.[1]);
            const source = sources[uid - 1];
            if (source) {
                if (rest.includes("BODY")) {
                    socket.write(
                        `* ${uid} FETCH (UID ${uid} BODY[]<0> {${source.length}}\r\n`,
                    );
                    socket.write(source);
                    socket.write(")\r\n");
                } else {
                    const person = '((NIL NIL "friend" "example.com"))';
                    socket.write(
                        `* ${uid} FETCH (UID ${uid} RFC822.SIZE ${source.length} ENVELOPE ("Tue, 3 Nov 2026 12:00:00 +0000" "Real IMAP" ${person} ${person} ${person} ((NIL NIL "me" "example.com")) NIL NIL NIL "<${uid}@example.com>"))\r\n`,
                    );
                }
            }
        } else if (command === "IDLE") {
            idleTags.set(socket, tag);
            socket.write("+ idling\r\n");
            events.emit("idle");
            return;
        } else if (
            !["AUTHENTICATE", "LOGIN", "NOOP", "LOGOUT"].includes(command)
        ) {
            throw new Error(`unexpected IMAP command ${command}`);
        }
        ok();
    },
);
let dataMode = false;
let data = [];
const smtp = serve("220 localhost test SMTP\r\n", (socket, line) => {
    if (dataMode) {
        if (line === ".") {
            submissions.push(data.join("\r\n"));
            dataMode = false;
            data = [];
            socket.write("250 queued\r\n");
        } else data.push(line);
        return;
    }
    const command = line.split(" ")[0].toUpperCase();
    if (command === "EHLO") socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
    else if (command === "AUTH") socket.write("235 authenticated\r\n");
    else if (command === "DATA") {
        dataMode = true;
        socket.write("354 send message\r\n");
    } else if (command === "RCPT" && line.includes("bad@example.com"))
        socket.write("550 no such recipient\r\n");
    else if (["MAIL", "RCPT", "RSET", "QUIT"].includes(command))
        socket.write("250 OK\r\n");
    else throw new Error(`unexpected SMTP command ${command}`);
});
const actor = { id: "me@example.com", type: "person" };
const job = (type, object) => ({
    "@context": [],
    type,
    actor,
    ...(object ? { object: { type: "message", ...object } } : {}),
});
const call = (invoke) =>
    new Promise((resolve, reject) =>
        invoke((error, result) => (error ? reject(error) : resolve(result))),
    );
const output = new EventEmitter();
const session = {
    log: { debug() {}, info() {}, warn() {}, error() {} },
    updateActor: async () => {},
    sendToClient(message) {
        output.emit(message.type, message);
    },
};
const platform = new Email(session, {
    imap: (options) =>
        new ImapFlow({
            ...options,
            tls: { ...options.tls, ca },
            autoIdleDelay: 10,
        }),
    smtp: (options) =>
        createTransport({ ...options, tls: { ...options.tls, ca } }),
});
platform.config.allowPrivateAddresses = true;

try {
    imap.listen(0);
    smtp.listen(0);
    await Promise.all([once(imap, "listening"), once(smtp, "listening")]);
    const settings = {
        host: "localhost",
        secure: true,
        username: actor.id,
        password: "test-password",
    };
    const credentials = {
        "@context": [],
        type: "credentials",
        actor,
        object: {
            type: "credentials",
            from: actor.id,
            imap: { ...settings, port: imap.address().port },
            smtp: { ...settings, port: smtp.address().port },
        },
    };
    const untrusted = new Email(session);
    untrusted.config.allowPrivateAddresses = true;
    await assert.rejects(
        call((done) => untrusted.connect(job("connect"), credentials, done)),
        /email:connect-failed/,
    );
    untrusted.cleanup(() => {});
    await call((done) => platform.connect(job("connect"), credentials, done));
    const fetched = await call((done) =>
        platform.fetch(job("fetch", { from: ["friend@example.com"] }), done),
    );
    assert.equal(fetched.items.length, 1);
    assert.match(fetched.items[0].object.content, /Hello over TLS/);
    assert.equal(fetched.cursors.INBOX.uidValidity, "7");
    await call((done) =>
        platform.watch(job("watch", { to: [actor.id] }), done),
    );
    if (!idleTags.size) await once(events, "idle", { signal: commandTimeout });
    const incoming = once(output, "post", { signal: commandTimeout });
    sources.push(sources[0]);
    for (const socket of imapSockets)
        if (!socket.destroyed) socket.write("* 2 EXISTS\r\n");
    const [received] = await incoming;
    assert.equal(received.object.uid, 2);
    await call((done) => platform.unwatch(job("unwatch"), done));
    const sent = await call((done) =>
        platform.send(
            job("send", {
                to: ["friend@example.com", "bad@example.com"],
                subject: "Real SMTP",
                content: "Hello over SMTP",
            }),
            credentials,
            done,
        ),
    );
    assert.deepEqual(sent.object.accepted, ["friend@example.com"]);
    assert.deepEqual(sent.object.rejected, ["bad@example.com"]);
    assert.equal(submissions.length, 1);
    assert.match(submissions[0], /Hello over SMTP/);
    await call((done) => platform.disconnect(job("disconnect"), done));
    console.log(`Email TLS fetch/watch/send: ok on ${process.version}`);
} finally {
    platform.cleanup(() => {});
    for (const socket of sockets) socket.destroy();
    await Promise.all([
        new Promise((resolve) => imap.close(resolve)),
        new Promise((resolve) => smtp.close(resolve)),
    ]);
    rmSync(directory, { recursive: true, force: true });
}
