import { describe, expect, it } from "bun:test";

import { parseInfoFlag, renderHelp } from "./cli.js";
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
            "--sentry-test",
            "--version",
            "--help",
        ]) {
            expect(help).toContain(flag);
        }
    });
});
