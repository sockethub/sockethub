import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { defaultSentryRelease, SOCKETHUB_VERSION } from "./version.js";

describe("version", () => {
    const packageJson = JSON.parse(
        readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"),
    );

    it("reports the running package version", () => {
        expect(SOCKETHUB_VERSION).toBe(packageJson.version);
    });

    it("resolves to a non-empty version string", () => {
        // A broken relative path to the manifest would surface here as
        // undefined rather than as a mis-tagged release in production.
        expect(typeof SOCKETHUB_VERSION).toBe("string");
        expect(SOCKETHUB_VERSION.length).toBeGreaterThan(0);
    });

    it("builds a sentry release identifier from that version", () => {
        expect(defaultSentryRelease()).toBe(`sockethub@${packageJson.version}`);
    });
});
