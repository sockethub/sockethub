import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
    SockethubConfigSchema,
    validateSockethubConfig,
} from "@sockethub/schemas";

import {
    buildConvictDefinition,
    buildSchema,
    EMPTY_ENV_IS_UNSET_VARS,
    getDefaultConfig,
} from "./config-schema.js";

describe("config-schema", () => {
    let originalEnv: NodeJS.ProcessEnv;
    let originalArgv: Array<string>;

    beforeEach(() => {
        originalEnv = process.env;
        // Strip mapped env vars and runner args so convict sees pure defaults.
        process.env = {};
        originalArgv = process.argv;
        process.argv = ["node", "test"];
    });

    afterEach(() => {
        process.env = originalEnv;
        process.argv = originalArgv;
    });

    describe("drift guard", () => {
        it("convict defaults match the JSON schema defaults exactly", () => {
            const convictDefaults = buildSchema().getProperties();
            expect(convictDefaults).toEqual({
                // $schema is overlay-supplied; every other value must come
                // from the JSON schema.
                $schema: "",
                ...getDefaultConfig(),
            });
        });

        it("the default config validates against the canonical schema", () => {
            expect(validateSockethubConfig(getDefaultConfig())).toEqual("");
        });

        it("every JSON schema leaf carries a default", () => {
            // buildConvictDefinition throws if any leaf lacks a default in
            // both the JSON schema and the overlay; building the real schema
            // exercises every leaf.
            expect(() => buildSchema()).not.toThrow();
        });
    });

    describe("known values survive derivation", () => {
        it("keeps representative defaults", () => {
            const conf = buildSchema();
            expect(conf.get("sockethub.port")).toBe(10550);
            expect(conf.get("sockethub.cors.origin")).toBe("*");
            expect(conf.get("redis.url")).toBe("redis://127.0.0.1:6379");
            expect(conf.get("redis.maxRetriesPerRequest")).toBeNull();
            expect(conf.get("credentials.ttlMs")).toBe(604800000);
            expect(conf.get("logging.level")).toBe("info");
            expect(conf.get("packageConfig")).toEqual({});
            expect(conf.get("platforms")).toContain(
                "@sockethub/platform-feeds",
            );
        });

        it("keeps enum validation for logging levels", () => {
            const conf = buildSchema();
            conf.set("logging.level", "not-a-level");
            expect(() => conf.validate({ allowed: "strict" })).toThrow();
        });

        it("keeps nat validation for numeric keys", () => {
            const conf = buildSchema();
            conf.set("rateLimiter.windowMs", -5);
            expect(() => conf.validate({ allowed: "strict" })).toThrow();
        });

        it("keeps env bindings", () => {
            process.env.SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS = "9000";
            const conf = buildSchema();
            expect(conf.get("platformHeartbeat.intervalMs")).toBe(9000);
        });

        it("does not share mutable defaults between instances", () => {
            const first = buildSchema();
            (first.get("platforms") as Array<string>).push("mutated");
            const second = buildSchema();
            expect(second.get("platforms")).not.toContain("mutated");
        });
    });

    describe("empty-env-is-unset list", () => {
        it("contains the historically mapped env vars", () => {
            for (const name of [
                "HOST",
                "PORT",
                "REDIS_URL",
                "LOG_LEVEL",
                "SOCKETHUB_CREDENTIALS_TTL_MS",
                "SOCKETHUB_HTTP_ACTIONS_ENABLED",
            ]) {
                expect(EMPTY_ENV_IS_UNSET_VARS).toContain(name);
            }
        });

        it("excludes SOCKETHUB_CORS_ORIGIN so empty stays fail-closed", () => {
            expect(EMPTY_ENV_IS_UNSET_VARS).not.toContain(
                "SOCKETHUB_CORS_ORIGIN",
            );
        });
    });

    describe("getDefaultConfig", () => {
        it("omits $schema", () => {
            expect(getDefaultConfig()).not.toHaveProperty("$schema");
        });

        it("returns a fresh tree on every call", () => {
            const first = getDefaultConfig();
            (first.platforms as Array<string>).push("mutated");
            expect(getDefaultConfig().platforms).not.toContain("mutated");
        });
    });

    describe("buildConvictDefinition", () => {
        it("derives every leaf declared in the canonical schema", () => {
            const definition = buildConvictDefinition(SockethubConfigSchema, {
                // The two entries whose defaults/shape only the overlay knows.
                $schema: { default: "" },
                packageConfig: { leaf: true, format: Object },
            });
            // Spot-check nesting: a branch node recursed, a leaf carries
            // format/default.
            const sockethub = definition.sockethub as Record<
                string,
                Record<string, unknown>
            >;
            expect(sockethub.port.default).toBe(10550);
        });

        it("throws on an overlay path missing from the schema", () => {
            expect(() =>
                buildConvictDefinition(
                    { properties: { a: { type: "string", default: "x" } } },
                    { "no.such.path": { format: "nat" } },
                ),
            ).toThrow(/missing from the JSON schema/);
        });

        it("throws on a leaf without a default anywhere", () => {
            expect(() =>
                buildConvictDefinition(
                    { properties: { a: { type: "string" } } },
                    {},
                ),
            ).toThrow(/no default declared/);
        });

        it("throws on an unsupported type", () => {
            expect(() =>
                buildConvictDefinition(
                    {
                        properties: {
                            a: { type: "bogus", default: 1 },
                        },
                    },
                    {},
                ),
            ).toThrow(/unsupported type/);
        });
    });
});
