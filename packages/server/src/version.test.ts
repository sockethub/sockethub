import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
    apiVersionFromSemver,
    defaultSentryRelease,
    SOCKETHUB_API_VERSION,
    SOCKETHUB_VERSION,
} from "./version.js";

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

    describe("apiVersionFromSemver", () => {
        it("reports the SemVer major", () => {
            expect(apiVersionFromSemver("5.2.1")).toBe(5);
            expect(apiVersionFromSemver("2.0.3")).toBe(2);
            expect(apiVersionFromSemver("0.4.0")).toBe(0);
            expect(apiVersionFromSemver("12.0.0")).toBe(12);
        });

        it("ignores prerelease and build metadata", () => {
            expect(apiVersionFromSemver("5.0.0-alpha.24")).toBe(5);
            expect(apiVersionFromSemver("1.0.1-alpha.19")).toBe(1);
            expect(apiVersionFromSemver("3.1.0+build.7")).toBe(3);
        });

        it("tolerates a leading v and partial versions", () => {
            expect(apiVersionFromSemver("v4.1.0")).toBe(4);
            expect(apiVersionFromSemver("1.0")).toBe(1);
            expect(apiVersionFromSemver("7")).toBe(7);
        });

        it("throws when there is no major version to read", () => {
            for (const bad of ["", "latest", "x.1.0", "1x.0.0", ".5.0"]) {
                expect(() => apiVersionFromSemver(bad)).toThrow(
                    "cannot derive API version",
                );
            }
        });

        it("throws on a malformed version instead of reading its leading digits", () => {
            for (const bad of [
                "1.invalid",
                "1.",
                "1+",
                "1-",
                "1.2.3.4",
                "1.0.0-",
                "1.0.0 beta",
                "99999999999999999999.0.0",
            ]) {
                expect(() => apiVersionFromSemver(bad)).toThrow(
                    "cannot derive API version",
                );
            }
        });

        it("derives the global API version from the server package", () => {
            expect(SOCKETHUB_API_VERSION).toBe(
                Number(packageJson.version.split(".")[0]),
            );
        });
    });
});
