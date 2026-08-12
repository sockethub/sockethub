import { describe, expect, it } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Agent } from "undici";

import {
    createGuardedConnector,
    createGuardedDispatcher,
    createGuardedLookup,
} from "./dispatcher.js";

// The DNS and connector guards are tested directly because the Bun test runner
// intercepts `fetch` and ignores undici dispatchers. A subprocess regression
// test below exercises the complete dispatcher with real Node and undici.

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

    it("blocks private IP literals before invoking the connector", () => {
        for (const hostname of ["127.0.0.1", "169.254.169.254", "[::1]"]) {
            let connected = false;
            const connector = createGuardedConnector(false, () => {
                connected = true;
            });
            let error: Error | null = null;

            connector(
                { hostname, protocol: "http:", port: "80" },
                (result) => {
                    error = result;
                },
            );

            expect(connected).toBe(false);
            expect(error?.message).toContain("blocked non-public address");
        }
    });

    it("passes public literals and private-address opt-ins to the connector", () => {
        const connected: string[] = [];
        const base = (options: { hostname: string }) => {
            connected.push(options.hostname);
        };
        const guarded = createGuardedConnector(false, base);
        const permissive = createGuardedConnector(true, base);
        const callback = () => {};

        guarded(
            { hostname: "8.8.8.8", protocol: "http:", port: "80" },
            callback,
        );
        permissive(
            { hostname: "[::1]", protocol: "http:", port: "80" },
            callback,
        );

        expect(connected).toEqual(["8.8.8.8", "[::1]"]);
    });

    it("blocks a normalized IP literal through real Node and undici", async () => {
        const moduleUrl = pathToFileURL(
            join(import.meta.dir, "../../dist/net/index.js"),
        ).href;
        const script = `
            import { request } from "undici";
            import { createGuardedDispatcher } from ${JSON.stringify(moduleUrl)};
            const dispatcher = createGuardedDispatcher();
            for (const url of ["http://2130706433:9/", "http://0x7f000001:9/"]) {
                try {
                    await request(url, { dispatcher });
                    process.exitCode = 1;
                } catch (error) {
                    const detail = [error.message, error.cause?.message]
                        .filter(Boolean)
                        .join(" ");
                    if (!detail.includes("blocked non-public address 127.0.0.1")) {
                        console.error(detail);
                        process.exitCode = 1;
                    }
                }
                if (process.exitCode) {
                    process.exitCode = 1;
                    break;
                }
            }
            await dispatcher.close();
        `;
        const process = Bun.spawn(
            ["node", "--input-type=module", "--eval", script],
            { stdout: "pipe", stderr: "pipe" },
        );
        const [exitCode, stdout, stderr] = await Promise.all([
            process.exited,
            new Response(process.stdout).text(),
            new Response(process.stderr).text(),
        ]);

        expect(`${stdout}${stderr}`).toBe("");
        expect(exitCode).toBe(0);
    });
});
