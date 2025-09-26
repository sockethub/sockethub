import { beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "path";

// Mock config to avoid loading real configuration
const mockConfig = {
    get: mock((key: string) => {
        if (key === "sentry:dsn") {
            return "https://ffc702eb2f3b24d9e06ca20e1ef1fd09@o4508859714895872.ingest.de.sentry.io/4508859718369360";
        }
        if (key === "sentry") {
            return {
                dsn: "https://ffc702eb2f3b24d9e06ca20e1ef1fd09@o4508859714895872.ingest.de.sentry.io/4508859718369360",
                environment: "test",
                traceSampleRate: 1.0
            };
        }
        return null;
    })
};

describe("Sentry Integration Bug - Issue #918", () => {
    beforeEach(() => {
        // Clear any existing Sentry instances
        delete require.cache[require.resolve("./sentry.js")];
        mockConfig.get.mockClear();
    });

    it("should reproduce 'A Proxy's target should be an Object' error", async () => {
        // This test reproduces the bug by initializing Sentry with Bun server instrumentation
        // The error occurs when Sentry's Bun integration tries to instrument server options
        let sentryError: Error | null = null;

        try {
            // Mock the config module
            require.cache[require.resolve("./config.js")] = {
                exports: { default: mockConfig },
                loaded: true,
                children: [],
                parent: null,
                filename: require.resolve("./config.js"),
                id: require.resolve("./config.js"),
                paths: [],
            };

            // Import Sentry module which triggers initialization
            await import("./sentry.js");
        } catch (error) {
            sentryError = error as Error;
        }

        // Expect that we catch the Proxy error
        expect(sentryError).not.toBeNull();
        expect(sentryError?.message).toContain("A Proxy's 'target' should be an Object");
    });

    it("should identify the problematic Sentry version", () => {
        // This test documents the problematic dependency version
        const packageJson = require("../package.json");
        expect(packageJson.dependencies["@sentry/bun"]).toBe("^9.1.0");
        
        // The actual installed version from bun.lock is 9.5.0
        // This version contains the bug in bunserver.js:56:28
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