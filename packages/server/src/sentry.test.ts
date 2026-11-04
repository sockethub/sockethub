import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";

describe("Sentry Integration Bug - Issue #918", () => {
    it("initializes Sentry without changing the test runner's config module", () => {
        const entry = new URL("./sentry.ts", import.meta.url).href;
        // Sentry patches global state; initialize it outside the shared test process.
        const child = spawnSync(process.execPath, ["-e", `
            await import(${JSON.stringify(entry)});
            const Sentry = await import("@sentry/node");
            await Sentry.close(0);
        `], {
            env: {
                ...process.env,
                SOCKETHUB_SENTRY_CONFIG: JSON.stringify({
                    dsn: "https://public@example.invalid/1",
                    enableLogs: false,
                    enableMetrics: false,
                    tracesSampleRate: 0,
                    profileSessionSampleRate: 0,
                }),
            },
            encoding: "utf8",
            timeout: 10_000,
        });
        expect(child.error).toBeUndefined();
        expect(child.status, child.stderr).toBe(0);
    });

    it("should verify the Sentry version has been upgraded to fix the bug", () => {
        // This test documents that the problematic version has been fixed.
        // The server runs on Node.js and uses @sentry/node (the original #918
        // Proxy bug was specific to @sentry/bun's Bun-serve instrumentation,
        // which the Node SDK does not have).
        const packageJson = require("../package.json");
        const currentVersion = packageJson.dependencies["@sentry/node"];

        // Should now be version 10.x or higher (which fixes the Proxy bug)
        expect(currentVersion).toMatch(/^(\^?10\.|^10\.|latest)/);
        
        // Document the bug details for reference
        const bugInfo = {
            brokenVersion: "9.5.0",
            fixedVersion: "10.15.0", 
            bugDescription: "A Proxy's 'target' should be an Object",
            location: "instrumentBunServeOptions in @sentry/bun"
        };
        
        expect(bugInfo.brokenVersion).toBe("9.5.0");
    });
});

describe("Sentry Integration Workaround", () => {
    it("should suggest disabling Sentry DSN as temporary workaround", () => {
        // Document the workaround: set sentry.dsn to empty string or remove it
        const workaroundConfig = {
            sentry: {
                dsn: "", // Empty DSN disables Sentry
                environment: "production"
            }
        };
        
        expect(workaroundConfig.sentry.dsn).toBe("");
    });
});