import { afterAll, beforeAll, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

// The host-meta patch in guard.ts only works if it modifies the module copy
// that the bundled client uses, so check it against a fresh build of the
// published bundle rather than against src. It is built inside the package,
// like dist/, so anything left unbundled resolves the same way.
let outdir = "";
const fetches: string[] = [];
const realFetch = globalThis.fetch;

beforeAll(async () => {
    outdir = mkdtempSync(join(import.meta.dir, "..", ".dist-test-"));
    const result = await Bun.build({
        entrypoints: [join(import.meta.dir, "index.ts")],
        outdir,
        target: "node",
        format: "esm",
    });
    if (!result.success) {
        throw new AggregateError(result.logs, "platform-xmpp build failed");
    }
    // @xmpp/resolve reads globalThis.fetch once, when the bundle loads.
    globalThis.fetch = (async (input: string | URL | Request) => {
        fetches.push(String(input instanceof Request ? input.url : input));
        return new Response("<XRD/>");
    }) as typeof fetch;
});

afterAll(() => {
    globalThis.fetch = realFetch;
    if (outdir) {
        rmSync(outdir, { recursive: true, force: true });
    }
});

it("never fetches host-meta when connecting to a bare host", async () => {
    const { default: XMPP } = await import(join(outdir, "index.js"));
    const log = { error() {}, warn() {}, info() {}, debug() {} };
    const xp = new XMPP({
        id: "u@localhost",
        log,
        sendToClient() {},
        updateActor: async () => {},
    });
    const credentials = {
        actor: { type: "person", id: "u@localhost" },
        object: {
            type: "credentials",
            userAddress: "u@localhost",
            password: "p",
            resource: "test",
        },
    };
    const err = await new Promise((resolve) =>
        xp.connect(
            { type: "connect", actor: credentials.actor },
            credentials,
            resolve,
        ),
    );
    // localhost only resolves to blocked addresses, so the connect fails.
    expect(err).toBeTruthy();
    expect(fetches).toEqual([]);
    await new Promise<void>((resolve) => xp.cleanup(() => resolve()));
});
