import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { Config } from "./config.js";

describe("config", () => {
    let originalEnv: NodeJS.ProcessEnv;
    let originalArgv: Array<string>;
    const tmpFiles: Array<string> = [];

    function writeConfig(contents: unknown): string {
        const file = path.join(
            os.tmpdir(),
            `sh-config-${tmpFiles.length}-test.json`,
        );
        fs.writeFileSync(file, JSON.stringify(contents));
        tmpFiles.push(file);
        return file;
    }

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };
        originalArgv = process.argv;
        // Strip any args the test runner passed so they don't leak into convict.
        process.argv = ["node", "test"];
    });

    afterEach(() => {
        process.env = originalEnv;
        process.argv = originalArgv;
        for (const file of tmpFiles.splice(0)) {
            fs.rmSync(file, { force: true });
        }
    });

    it("loads default values", () => {
        const config = new Config();
        expect(config).toHaveProperty("get");
        expect(config.get("sockethub:host")).toEqual("localhost");
    });

    it("host overrides from env", () => {
        const hostname = "a host string";
        process.env.HOST = hostname;
        const config = new Config();
        expect(config.get("sockethub:host")).toEqual(hostname);
    });

    it("defaults to redis config", () => {
        process.env.REDIS_URL = "";
        const config = new Config();
        expect(config.get("redis")).toEqual({
            url: "redis://127.0.0.1:6379",
            connectTimeout: 10000,
            disconnectTimeout: 5000,
            maxRetriesPerRequest: null,
        });
    });

    it("redis url overridden by env var", () => {
        process.env.REDIS_URL = "redis://example:6380";
        const config = new Config();
        expect(config.get("redis:url")).toEqual("redis://example:6380");
    });

    it("treats an empty-string env var as unset (falls back to default)", () => {
        process.env.HOST = "";
        const config = new Config();
        expect(config.get("sockethub:host")).toEqual("localhost");
    });

    it("accepts both colon and dot path separators", () => {
        const config = new Config();
        expect(config.get("sockethub:port")).toEqual(
            config.get("sockethub.port"),
        );
    });

    it("returns a whole subtree for a top-level key", () => {
        const config = new Config();
        const sockethub = config.get("sockethub") as Record<string, unknown>;
        expect(sockethub).toMatchObject({
            host: "localhost",
            path: "/sockethub",
        });
        expect(typeof sockethub.port).toBe("number");
    });

    it("coerces port to a number", () => {
        process.env.PORT = "12345";
        const config = new Config();
        expect(config.get("sockethub:port")).toBe(12345);
    });

    it("applies a --port command-line argument", () => {
        process.argv = ["node", "test", "--port", "13579"];
        const config = new Config();
        expect(config.get("sockethub:port")).toBe(13579);
    });

    it("command-line arg takes precedence over env", () => {
        process.env.HOST = "env-host";
        process.argv = ["node", "test", "--host", "arg-host"];
        const config = new Config();
        expect(config.get("sockethub:host")).toEqual("arg-host");
    });

    it("throws when an explicitly-specified config file is missing", () => {
        process.argv = ["node", "test", "--config", "/no/such/config.json"];
        expect(() => new Config()).toThrow(/Config file not found/);
    });

    it("throws when SOCKETHUB_CONFIG points at a missing file", () => {
        process.env.SOCKETHUB_CONFIG = "/no/such/config.json";
        expect(() => new Config()).toThrow(/Config file not found/);
    });

    it("throws a clear error when --config is given without a path", () => {
        process.argv = ["node", "test", "--config"];
        expect(() => new Config()).toThrow(/requires a file path/);
    });

    it("exposes the platforms array", () => {
        const config = new Config();
        const platforms = config.get("platforms") as Array<string>;
        expect(Array.isArray(platforms)).toBe(true);
        expect(platforms).toContain("@sockethub/platform-feeds");
    });

    it("applies the heartbeat interval env override", () => {
        process.env.SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS = "9000";
        const config = new Config();
        expect(config.get("platformHeartbeat:intervalMs")).toBe(9000);
    });

    it("strictly rejects an unknown key in a config file", () => {
        const file = writeConfig({
            platforms: ["@sockethub/platform-feeds"],
            notARealKey: true,
        });
        process.argv = ["node", "test", "--config", file];
        expect(() => new Config()).toThrow();
    });

    it("rejects a mis-typed value in a config file", () => {
        const file = writeConfig({
            platforms: ["@sockethub/platform-feeds"],
            logging: { level: "not-a-level" },
        });
        process.argv = ["node", "test", "--config", file];
        expect(() => new Config()).toThrow();
    });

    it("loads packageConfig from a config file", () => {
        const file = writeConfig({
            platforms: ["@sockethub/platform-feeds"],
            packageConfig: {
                "@sockethub/platform-feeds": { connectTimeoutMs: 7000 },
            },
        });
        process.argv = ["node", "test", "--config", file];
        const config = new Config();
        expect(config.get("packageConfig")).toEqual({
            "@sockethub/platform-feeds": { connectTimeoutMs: 7000 },
        });
    });

    it("rejects a mis-typed packageConfig value", () => {
        const file = writeConfig({
            platforms: ["@sockethub/platform-feeds"],
            packageConfig: {
                "@sockethub/platform-feeds": { connectTimeoutMs: "7000" },
            },
        });
        process.argv = ["node", "test", "--config", file];
        expect(() => new Config()).toThrow(/invalid configuration/);
    });

    it("rejects an unknown key within a packageConfig entry", () => {
        const file = writeConfig({
            platforms: ["@sockethub/platform-feeds"],
            packageConfig: {
                "@sockethub/platform-feeds": { bogusKey: true },
            },
        });
        process.argv = ["node", "test", "--config", file];
        expect(() => new Config()).toThrow(/invalid configuration/);
    });
});
