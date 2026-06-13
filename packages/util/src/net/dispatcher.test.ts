import { describe, expect, it } from "bun:test";
import { Agent } from "undici";

import {
    createGuardedDispatcher,
    createGuardedLookup,
} from "./dispatcher.js";

// The guarded lookup is the SSRF decision point. It is tested directly (rather
// than through an end-to-end fetch) because the Bun test runner intercepts
// `fetch` and ignores undici dispatchers; production code paths run on Node,
// where undici honors the dispatcher's `connect.lookup`. IP-literal hosts are
// resolved by dns.lookup without a network query, so these are deterministic.

function runLookup(
    allowPrivate: boolean,
    host: string,
): Promise<{ err: Error | null; addresses?: Array<{ address: string }> }> {
    return new Promise((resolve) => {
        createGuardedLookup(allowPrivate)(
            host,
            { all: true },
            (err, addresses) => {
                resolve({
                    err: err ?? null,
                    addresses: addresses as Array<{ address: string }>,
                });
            },
        );
    });
}

describe("createGuardedLookup", () => {
    it("blocks a loopback IPv4 literal", async () => {
        const { err } = await runLookup(false, "127.0.0.1");
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toMatch(/blocked non-public address 127\.0\.0\.1/);
    });

    it("blocks the cloud metadata address", async () => {
        const { err } = await runLookup(false, "169.254.169.254");
        expect(err?.message).toMatch(/blocked non-public address/);
    });

    it("blocks an IPv4-mapped IPv6 loopback literal", async () => {
        const { err } = await runLookup(false, "::ffff:7f00:1");
        expect(err).toBeInstanceOf(Error);
    });

    it("allows a public address", async () => {
        const { err, addresses } = await runLookup(false, "8.8.8.8");
        expect(err).toBeNull();
        expect(addresses?.[0]?.address).toEqual("8.8.8.8");
    });

    it("allows a loopback address when the escape hatch is enabled", async () => {
        const { err, addresses } = await runLookup(true, "127.0.0.1");
        expect(err).toBeNull();
        expect(addresses?.[0]?.address).toEqual("127.0.0.1");
    });
});

describe("createGuardedDispatcher", () => {
    it("constructs an undici Agent without throwing", () => {
        // Behavior (lookup blocking, size cap) is exercised in production via
        // undici on Node; the Bun runner's undici Agent is a stub, so only
        // construction is asserted here.
        const dispatcher = createGuardedDispatcher({
            allowPrivateAddresses: true,
            maxResponseBytes: 1024,
        });
        expect(dispatcher).toBeInstanceOf(Agent);
    });
});
