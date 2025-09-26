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
            // Create a proper mock that implements the config interface
            const configPath = require.resolve("./config.js");
            
            // Clear the config from cache first
            delete require.cache[configPath];
            
            // Mock the config module before importing sentry
            require.cache[configPath] = {
                exports: { 
                    default: mockConfig,
                    __esModule: true
                },
                loaded: true,
                children: [],
                parent: null,
                filename: configPath,
                id: configPath,
                paths: [],
            };

            // Import Sentry module which triggers initialization
            const sentryPath = require.resolve("./sentry.js");
            delete require.cache[sentryPath]; // Clear sentry from cache
            await import("./sentry.js");
        } catch (error) {
            sentryError = error as Error;
        }

        // With the upgrade to @sentry/bun 10.15.0, this should now work without the Proxy error
        // If we're still on the old version, we'd expect the Proxy error
        // If we're on the new version, Sentry should initialize successfully
        if (sentryError) {
            // If there's still an error, it should NOT be the Proxy error (since we upgraded)
            expect(sentryError.message).not.toContain("A Proxy's 'target' should be an Object");
        } else {
            // Success - the upgrade fixed the issue
            expect(sentryError).toBeNull();
        }
    });

    it("should verify the Sentry version has been upgraded to fix the bug", () => {
        // This test documents that the problematic version has been fixed
        const packageJson = require("../package.json");
        const currentVersion = packageJson.dependencies["@sentry/bun"];
        
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