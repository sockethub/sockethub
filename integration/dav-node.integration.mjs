// Node-runtime regression check for sockethub/sockethub#1293.
//
// The DAV clients route requests through an SSRF-guarded undici dispatcher.
// On Node 26 the runtime's global `fetch` is a different undici major than
// the one we depend on, and mixing the two silently dropped every response
// header -- so the 401 challenge from Radicale never carried
// `WWW-Authenticate` and username/password authentication always failed.
//
// This script runs under plain `node` (the Bun test runner bypasses undici
// dispatchers, so it cannot reproduce the bug) against the built packages
// and the Radicale container from `bun run docker:start:caldav`.
//
//   node integration/dav-node.integration.mjs

import { DavClient } from "../packages/dav/dist/index.js";
import { CardDavClient } from "../packages/platform-carddav/dist/index.js";

const root = "http://127.0.0.1:5232/alice/";
const authentication = {
    username: "alice",
    password: "calendar-test-password",
};
const network = { allowPrivateAddresses: true, allowInsecureHttp: true };

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

await check("CardDavClient discovery authenticates", async () => {
    const client = new CardDavClient(root, authentication, 15_000, network);
    try {
        const books = await client.discoverAddressBooks();
        assert(Array.isArray(books), "discovery returned no list");
    } finally {
        await client.close();
    }
});

process.exitCode = failed ? 1 : 0;
