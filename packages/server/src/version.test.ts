import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

    it("reports an image build identifier while preserving API compatibility", () => {
        const dir = mkdtempSync(join(tmpdir(), "sockethub-version-"));
        try {
            writeFileSync(
                join(dir, "package.json"),
                JSON.stringify({ version: "5.0.0", buildVersion: "master-20261110123456" }),
            );
            // The module resolves its manifest one directory above itself.
            mkdirSync(join(dir, "src"));
            writeFileSync(
                join(dir, "src", "version.ts"),
                readFileSync(join(import.meta.dir, "version.ts")),
            );
            const modulePath = JSON.stringify(join(dir, "src", "version.ts"));
            const result = Bun.spawnSync([process.execPath, "-e", `
                const v = await import(${modulePath});
                console.log(JSON.stringify([v.SOCKETHUB_VERSION, v.SOCKETHUB_API_VERSION, v.defaultSentryRelease()]));
            `]);
            expect(result.exitCode).toBe(0);
            expect(JSON.parse(result.stdout.toString())).toEqual([
                "master-20261110123456", 5, "sockethub@master-20261110123456",
            ]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
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
