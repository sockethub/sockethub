import fs from "node:fs";
import path from "node:path";
import { validateSockethubConfig } from "@sockethub/schemas";
import type convict from "convict";

import { buildSchema, EMPTY_ENV_IS_UNSET_VARS } from "./config-schema.js";
import { createWinstonLogger, type Logger } from "./logger-core.js";

const defaultConfig = "sockethub.config.json";

/**
 * Resolve the config file path. Precedence: the `--config`/`-c` command-line
 * argument, then the `SOCKETHUB_CONFIG` environment variable, then
 * `sockethub.config.json` in the current working directory. Returns
 * `{ file, explicit }` where `explicit` indicates the path was requested (via
 * flag or env) — a missing explicit file is an error; a missing default file
 * is not.
 */
function resolveConfigFile(): { file?: string; explicit: boolean } {
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--config" || arg === "-c") {
            const value = argv[i + 1];
            if (!value || value.startsWith("-")) {
                throw new Error(`${arg} requires a file path`);
            }
            return { file: value, explicit: true };
        }
        if (arg.startsWith("--config=")) {
            const value = arg.slice("--config=".length);
            if (!value) {
                throw new Error("--config requires a file path");
            }
            return { file: value, explicit: true };
        }
    }
    if (process.env.SOCKETHUB_CONFIG) {
        return { file: process.env.SOCKETHUB_CONFIG, explicit: true };
    }
    return { file: path.join(process.cwd(), defaultConfig), explicit: false };
}

export class Config {
    private log: Logger;
    private conf: convict.Config<Record<string, unknown>>;

    constructor() {
        this.log = createWinstonLogger("sockethub:server:bootstrap:config", {
            level: "info",
        });
        this.log.debug("initializing config");

        // Treat empty-string env vars as unset (historical `||` semantics).
        for (const name of EMPTY_ENV_IS_UNSET_VARS) {
            if (process.env[name] === "") {
                delete process.env[name];
            }
        }

        this.conf = buildSchema();

        const { file, explicit } = resolveConfigFile();
        if (file && fs.existsSync(file)) {
            const resolved = path.resolve(file);
            this.log.debug(`reading config file at ${resolved}`);
            this.conf.loadFile(resolved);
        } else if (explicit) {
            throw new Error(`Config file not found: ${file}`);
        }

        // Coerce + validate top-level keys/types. `strict` makes an unknown or
        // mis-typed top-level key a hard error rather than a silent no-op.
        this.conf.validate({ allowed: "strict" });

        // Validate the full materialized config against the canonical schema.
        // This adds depth convict's flat schema lacks — notably the contents of
        // each platform's `packageConfig` entry (e.g. a string `connectTimeoutMs`).
        const configError = validateSockethubConfig(this.conf.getProperties());
        if (configError) {
            throw new Error(`invalid configuration: ${configError}`);
        }

        const platforms = this.conf.get("platforms");
        if (!Array.isArray(platforms) || platforms.length === 0) {
            throw new Error("config: `platforms` must be a non-empty array");
        }
    }

    /**
     * Read a config value. Accepts both colon (`"redis:url"`) and dot
     * (`"redis.url"`) path separators; colon is the historical Sockethub style.
     * Passing a top-level key (e.g. `"redis"`) returns the whole subtree.
     */
    get = (key: string): unknown => {
        const path = key.replace(/:/g, ".");
        return this.conf.get(path);
    };
}

const config = new Config();
export default config;
