import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
    SockethubConfigSchemaId,
    validateSockethubConfig,
} from "@sockethub/schemas";

import {
    parseWriteConfigTarget,
    renderDefaultConfig,
    writeDefaultConfig,
} from "./write-config.js";

describe("write-config", () => {
    const tmpFiles: Array<string> = [];

    function tmpTarget(): string {
        const file = path.join(
            os.tmpdir(),
            `sh-write-config-${tmpFiles.length}-${process.pid}.json`,
        );
        tmpFiles.push(file);
        return file;
    }

    afterEach(() => {
        for (const file of tmpFiles.splice(0)) {
            fs.rmSync(file, { force: true });
        }
    });

    describe("parseWriteConfigTarget", () => {
        it("returns undefined when the flag is absent", () => {
            expect(parseWriteConfigTarget(["--port", "1234"])).toBeUndefined();
        });

        it("defaults to sockethub.config.json with no value", () => {
            expect(parseWriteConfigTarget(["--write-config"])).toEqual(
                "sockethub.config.json",
            );
        });

        it("accepts a separate path argument", () => {
            expect(
                parseWriteConfigTarget(["--write-config", "my.json"]),
            ).toEqual("my.json");
        });

        it("accepts --write-config=path", () => {
            expect(parseWriteConfigTarget(["--write-config=my.json"])).toEqual(
                "my.json",
            );
        });

        it("treats '-' as stdout", () => {
            expect(parseWriteConfigTarget(["--write-config", "-"])).toEqual(
                "-",
            );
        });

        it("does not consume a following flag as the path", () => {
            expect(
                parseWriteConfigTarget(["--write-config", "--examples"]),
            ).toEqual("sockethub.config.json");
        });
    });

    describe("renderDefaultConfig", () => {
        it("emits valid JSON that validates against the schema", () => {
            const parsed = JSON.parse(renderDefaultConfig());
            expect(validateSockethubConfig(parsed)).toEqual("");
        });

        it("stamps the versioned $schema reference", () => {
            const parsed = JSON.parse(renderDefaultConfig());
            expect(parsed.$schema).toEqual(SockethubConfigSchemaId);
            expect(parsed.$schema).not.toContain("/v/");
        });

        it("includes the full default tree", () => {
            const parsed = JSON.parse(renderDefaultConfig());
            expect(parsed.sockethub.port).toBe(10550);
            expect(parsed.platforms).toContain("@sockethub/platform-feeds");
            expect(parsed.httpActions.enabled).toBe(false);
            expect(parsed.redis.maxRetriesPerRequest).toBeNull();
        });
    });

    describe("writeDefaultConfig", () => {
        it("prints to stdout and writes no file for '-'", () => {
            let written = "";
            const spy = spyOn(process.stdout, "write").mockImplementation(
                (chunk: string | Uint8Array) => {
                    written += chunk.toString();
                    return true;
                },
            );
            try {
                const message = writeDefaultConfig("-");
                expect(message).toEqual("");
            } finally {
                spy.mockRestore();
            }
            // Round-trips: stdout carries the full valid config, not a path.
            expect(validateSockethubConfig(JSON.parse(written))).toEqual("");
        });

        it("writes the file and reports the resolved path", () => {
            const target = tmpTarget();
            const message = writeDefaultConfig(target);
            expect(message).toContain(path.resolve(target));
            const parsed = JSON.parse(fs.readFileSync(target, "utf-8"));
            expect(validateSockethubConfig(parsed)).toEqual("");
        });

        it("refuses to overwrite an existing file", () => {
            const target = tmpTarget();
            fs.writeFileSync(target, "{}");
            expect(() => writeDefaultConfig(target)).toThrow(
                /refusing to overwrite/,
            );
            expect(fs.readFileSync(target, "utf-8")).toEqual("{}");
        });
    });
});
