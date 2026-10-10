// Node-runtime regression checks for sockethub/sockethub#1293.
//
// DAV HTTP clients route requests through an SSRF-guarded undici dispatcher.
// On Node 26 the runtime's global `fetch` is a different undici major than
// the one we depend on, and mixing the two silently dropped every response
// header -- so the 401 challenge from Radicale never carried
// `WWW-Authenticate`, published iCalendar feeds lost redirect `Location`, and
// username/password authentication always failed.
//
// This script runs under plain `node` (the Bun test runner bypasses undici
// dispatchers, so it cannot reproduce the bug) against the built packages.
// The integration workflow executes it on Node 22, 24, and 26. Radicale checks
// need `bun run docker:start:caldav`; the CalDAV feed redirect check uses a
// local loopback server only.
//
//   node integration/dav-node.integration.mjs

import { createServer } from "node:http";
import { DavClient } from "../packages/dav/dist/index.js";
import CalDav from "../packages/platform-caldav/dist/index.js";
import { CardDavClient } from "../packages/platform-carddav/dist/index.js";

const root = "http://127.0.0.1:5232/alice/";
const authentication = {
    username: "alice",
    password: "calendar-test-password",
};
const network = { allowPrivateAddresses: true, allowInsecureHttp: true };
const feedIcs =
    "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nDTSTART:20260101T100000Z\r\nSUMMARY:A\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

let failed = false;
async function check(label, run) {
    try {
        await run();
        console.log(`${label}: ok on ${process.version}`);
    } catch (error) {
        failed = true;
        console.error(`${label}: FAILED on ${process.version}:`, error);
    }
}

await check("DavClient.request keeps response headers", async () => {
    const client = new DavClient(
        root,
        authentication,
        "davtest",
        15_000,
        network,
    );
    try {
        // PROPFIND goes 401 -> challenge -> authenticated retry inside
        // `request()`; with empty headers it throws
        // `davtest:unsupported-authentication` instead.
        const response = await client.request(new URL(root), {
            method: "PROPFIND",
            headers: { depth: "0", "content-type": "application/xml" },
            body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
        });
        await response.body?.cancel().catch(() => {});
        const keys = [...response.headers.keys()];
        assert(response.status === 207, `expected 207, got ${response.status}`);
        assert(keys.length > 0, "response headers are empty");
        assert(
            response.headers.has("content-type"),
            `content-type missing; got ${JSON.stringify(keys)}`,
        );
    } finally {
        await client.close();
    }
});

await check("CardDavClient full lifecycle authenticates", async () => {
    const client = new CardDavClient(root, authentication, 15_000, network);
    const bookId = `${root}sockethub-contacts/`;
    const uid = `sockethub-node-${crypto.randomUUID()}`;
    let created;
    try {
        // Create the address book the Bun suite also uses (idempotent).
        const mkcol = await fetch(bookId, {
            method: "MKCOL",
            headers: {
                authorization: `Basic ${Buffer.from(
                    `${authentication.username}:${authentication.password}`,
                ).toString("base64")}`,
                "content-type": "application/xml",
            },
            body: '<?xml version="1.0"?><d:mkcol xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:carddav"><d:set><d:prop><d:resourcetype><d:collection/><c:addressbook/></d:resourcetype><d:displayname>Sockethub Contacts</d:displayname></d:prop></d:set></d:mkcol>',
        });
        assert(
            [201, 405].includes(mkcol.status),
            `MKCOL returned ${mkcol.status}`,
        );

        const books = await client.discoverAddressBooks();
        const book = books.find((item) => item.id === bookId);
        assert(book, `address book ${bookId} not discovered`);

        // create -> query -> update -> delete exercises ETag and Location
        // headers on PUT/DELETE, which were also lost with empty headers.
        created = await client.create(book, {
            type: "person",
            uid,
            name: "Node Smoke",
            emails: [{ value: `${uid}@example.test` }],
        });
        assert(created.etag, "create returned no ETag");

        const found = (await client.query(book, { text: uid })).find(
            (item) => item.uid === uid,
        );
        assert(found, "created contact not returned by query");

        const updated = await client.update({
            ...found,
            name: "Node Smoke Updated",
        });
        assert(
            updated.etag && updated.etag !== found.etag,
            "update did not rotate ETag",
        );

        await client.delete(created.id, updated.etag);
        created = undefined;
        const remaining = await client.query(book, { text: uid });
        assert(
            !remaining.some((item) => item.uid === uid),
            "contact still present after delete",
        );
    } finally {
        if (created)
            await client.delete(created.id, created.etag).catch(() => {});
        await client.close();
    }
});

await check("CalDav.read follows feed redirects through undici fetch", async () => {
    const server = createServer((req, res) => {
        if (req.url === "/cal.ics") {
            res.writeHead(302, { location: "/moved.ics" });
            res.end();
            return;
        }
        res.setHeader("content-type", "text/calendar");
        res.end(feedIcs);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address();
    const platform = new CalDav({
        log: { error() {}, warn() {}, info() {}, debug() {} },
    });
    platform.config.allowPrivateAddresses = true;
    platform.config.allowInsecureHttp = true;
    try {
        const result = await new Promise((resolve, reject) => {
            platform.read(
                {
                    type: "read",
                    actor: { id: "caldav:alice", type: "person" },
                    target: {
                        id: `http://127.0.0.1:${port}/cal.ics`,
                        type: "feed",
                    },
                },
                (error, value) =>
                    error ? reject(new Error(String(error))) : resolve(value),
            );
        });
        const item = result.items?.[0];
        assert(
            item &&
                item.name === "A" &&
                String(item.id).endsWith("/moved.ics#a"),
            `unexpected read result: ${JSON.stringify(result)}`,
        );
    } finally {
        await new Promise((resolve) => platform.cleanup(resolve));
        server.close();
    }
});

process.exitCode = failed ? 1 : 0;
