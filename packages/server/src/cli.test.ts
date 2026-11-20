import { describe, expect, it } from "bun:test";

import { findUnknownFlag, parseInfoFlag, renderHelp } from "./cli.js";
import { CONFIG_FLAGS } from "./config-schema.js";
import { SOCKETHUB_VERSION } from "./version.js";

describe("parseInfoFlag", () => {
    it("recognizes --help and -h", () => {
        expect(parseInfoFlag(["--help"])).toBe("help");
        expect(parseInfoFlag(["-h"])).toBe("help");
    });

    it("recognizes --version and -v", () => {
        expect(parseInfoFlag(["--version"])).toBe("version");
        expect(parseInfoFlag(["-v"])).toBe("version");
    });

    it("finds the flag among other arguments", () => {
        expect(parseInfoFlag(["--config", "a.json", "--help"])).toBe("help");
    });

    it("prefers help when both are given", () => {
        expect(parseInfoFlag(["--version", "--help"])).toBe("help");
    });

    it("returns undefined for a normal invocation", () => {
        expect(parseInfoFlag([])).toBeUndefined();
        expect(parseInfoFlag(["--config", "sockethub.config.json"])).toBe(
            undefined,
        );
    });
});

describe("renderHelp", () => {
    it("names the running version", () => {
        expect(renderHelp()).toContain(SOCKETHUB_VERSION);
    });

    it("documents the flags that short-circuit startup", () => {
        const help = renderHelp();
        for (const flag of [
            "--config",
            "--write-config",
            "--write-config-webpush-enabled",
            "--webpush-subject",
            "--sentry-test",
            "--sentry-test-crash",
            "--version",
            "--help",
        ]) {
            expect(help).toContain(flag);
        }
    });
});

describe("findUnknownFlag", () => {
    it("accepts every documented flag, with and without values", () => {
        expect(
            findUnknownFlag([
                "--config",
                "a.json",
                "--host",
                "0.0.0.0",
                "--port=10550",
                "--examples",
                "--info",
            ]),
        ).toBeUndefined();
        expect(
            findUnknownFlag([
                "--write-config-webpush-enabled",
                "/etc/sockethub.json",
                "--webpush-subject",
                "mailto:ops@example.org",
            ]),
        ).toBeUndefined();
        expect(findUnknownFlag(["--write-config", "-"])).toBeUndefined();
        expect(findUnknownFlag([])).toBeUndefined();
    });

    it("accepts every flag bound to a config setting", () => {
        expect(CONFIG_FLAGS).toContain("--redis.url");
        expect(findUnknownFlag([...CONFIG_FLAGS])).toBeUndefined();
    });

    it("returns the first flag it does not recognize", () => {
        expect(findUnknownFlag(["--write-confg"])).toBe("--write-confg");
        expect(findUnknownFlag(["--port", "1", "--bogus=1", "-x"])).toBe(
            "--bogus=1",
        );
    });

    it("lists every config flag in the help text", () => {
        const help = renderHelp();
        for (const flag of CONFIG_FLAGS) {
            expect(help).toContain(flag);
        }
    });
});
