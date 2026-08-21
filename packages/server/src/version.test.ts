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
        // A manifest that resolves but carries no version would surface here
        // as undefined rather than as a mis-tagged release in production. (A
        // manifest that does not resolve at all throws on import instead.)
        expect(typeof SOCKETHUB_VERSION).toBe("string");
        expect(SOCKETHUB_VERSION.length).toBeGreaterThan(0);
    });

    it("builds a sentry release identifier from that version", () => {
        expect(defaultSentryRelease()).toBe(`sockethub@${packageJson.version}`);
    });
});
