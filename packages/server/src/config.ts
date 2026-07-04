import fs from "node:fs";
import path from "node:path";
import { validateSockethubConfig } from "@sockethub/schemas";
import convict from "convict";

import { createWinstonLogger, type Logger } from "./logger-core.js";

const defaultConfig = "sockethub.config.json";

// Environment variables that map onto config keys. An empty-string value is
// treated as "unset" so it falls back to the config file / default, preserving
// the historical `process.env.X || <config>` behavior (convict would otherwise
// apply the empty string as an override).
const MAPPED_ENV_VARS = [
    "HOST",
    "PORT",
    "REDIS_URL",
    "LOG_LEVEL",
    "LOG_FILE_LEVEL",
    "LOG_FILE",
    "SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS",
    "SOCKETHUB_PLATFORM_HEARTBEAT_TIMEOUT_MS",
] as const;

const LOG_LEVELS = ["error", "warn", "info", "debug"] as const;

/**
 * The convict configuration schema. Each key declares its format, default,
 * and (where applicable) the environment variable and/or command-line argument
 * that overrides it. Precedence, highest first: command-line arg, environment
 * variable, config file, schema default.
 */
function buildSchema(): convict.Config<Record<string, unknown>> {
    return convict({
        $schema: { format: String, default: "" },
        examples: {
            doc: "Enable the examples pages served at [host]:[port]/examples",
            format: Boolean,
            default: true,
            arg: "examples",
        },
        info: {
            doc: "Display Sockethub runtime information",
            format: Boolean,
            default: false,
            arg: "info",
        },
        logging: {
            level: {
                format: LOG_LEVELS,
                default: "info",
                env: "LOG_LEVEL",
            },
            fileLevel: {
                format: LOG_LEVELS,
                default: "debug",
                env: "LOG_FILE_LEVEL",
            },
            file: {
                format: String,
                default: "sockethub.log",
                env: "LOG_FILE",
            },
        },
        platforms: {
            doc: "Platform packages to load",
            format: Array,
            default: [
                "@sockethub/platform-dummy",
                "@sockethub/platform-feeds",
                "@sockethub/platform-irc",
                "@sockethub/platform-metadata",
                "@sockethub/platform-xmpp",
            ],
        },
        // Per-platform config keyed by package name. Free-form for now: no
        // server code consumes it yet (see README/follow-up).
        packageConfig: {
            format: Object,
            default: {},
        },
        public: {
            protocol: { format: String, default: "http" },
            host: { format: String, default: "localhost" },
            port: { format: "port", default: 10550 },
            path: { format: String, default: "/" },
        },
        rateLimiter: {
            windowMs: { format: "nat", default: 1000 },
            maxRequests: { format: "nat", default: 100 },
            blockDurationMs: { format: "nat", default: 5000 },
        },
        limits: {
            maxPlatformInstances: {
                doc:
                    "Upper bound on concurrently running platform instances " +
                    "(child processes). Each persistent-platform actor forks " +
                    "its own process, so an unbounded count is a resource " +
                    "exhaustion risk on public instances. 0 disables the cap.",
                format: "nat",
                default: 0,
            },
        },
        credentialCheck: {
            reconnectIpSource: {
                format: ["socket", "proxy"],
                default: "socket",
            },
            proxyHeader: { format: String, default: "x-forwarded-for" },
        },
        redis: {
            url: {
                format: String,
                default: "redis://127.0.0.1:6379",
                env: "REDIS_URL",
                arg: "redis.url",
            },
            connectTimeout: {
                format: "nat",
                default: 10000,
                doc: "Connection timeout in milliseconds",
            },
            disconnectTimeout: {
                format: "nat",
                default: 5000,
                doc: "Disconnect timeout in milliseconds",
            },
            maxRetriesPerRequest: {
                // number | null (null = BullMQ default)
                format: "*",
                default: null,
            },
        },
        sentry: {
            dsn: { format: String, default: "", arg: "sentry.dsn" },
            traceSampleRate: { format: Number, default: 1.0 },
        },
        sockethub: {
            port: {
                format: "port",
                default: 10550,
                env: "PORT",
                arg: "port",
            },
            host: {
                format: String,
                default: "localhost",
                env: "HOST",
                arg: "host",
            },
            path: { format: String, default: "/sockethub" },
        },
        platformHeartbeat: {
            intervalMs: {
                format: "nat",
                default: 5000,
                env: "SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS",
            },
            timeoutMs: {
                format: "nat",
                default: 15000,
                env: "SOCKETHUB_PLATFORM_HEARTBEAT_TIMEOUT_MS",
            },
        },
    });
}

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
        for (const name of MAPPED_ENV_VARS) {
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
