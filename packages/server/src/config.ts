import fs from "node:fs";
import path from "node:path";
import nconf from "nconf";

import { createWinstonLogger, type Logger } from "./logger-core.js";
import { __dirname } from "./util.js";

const data = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "defaults.json"), "utf-8"),
);

const defaultConfig = "sockethub.config.json";

export class Config {
    private log: Logger;

    constructor() {
        // Use core logger without config dependency
        this.log = createWinstonLogger("sockethub:server:bootstrap:config", {
            level: "info",
        });
        this.log.debug("initializing config");
        // assign config loading priorities (command-line, environment, cfg, defaults)
        nconf.argv({
            info: {
                type: "boolean",
                describe: "Display Sockethub runtime information",
            },
            examples: {
                type: "boolean",
                describe:
                    "Enable the examples pages served at [host]:[port]/examples",
            },
            config: {
                alias: "c",
                type: "string",
                describe: "Path to sockethub.config.json",
            },
            port: {
                type: "number",
                alias: "sockethub.port",
            },
            host: {
                type: "string",
                alias: "sockethub.host",
            },
            "redis.url": {
                type: "string",
                describe: "Redis URL e.g. redis://host:port",
            },
            "sentry.dsn": {
                type: "string",
                describe: "Provide your Sentry DSN",
            },
        });

        // get value of flags defined by any command-line params
        const examples = nconf.get("examples");

        // Load the main config
        let configFile = nconf.get("config");
        if (configFile) {
            configFile = path.resolve(configFile);
            if (!fs.existsSync(configFile)) {
                throw new Error(`Config file not found: ${configFile}`);
            }
            this.log.debug(`reading config file at ${configFile}`);
            nconf.file(configFile);
        } else {
            if (fs.existsSync(`${process.cwd()}/${defaultConfig}`)) {
                this.log.debug(`loading local ${defaultConfig}`);
                nconf.file(`${process.cwd()}/${defaultConfig}`);
            }
            nconf.use("memory");
        }

        // only override config file if explicitly mentioned in command-line params
        nconf.set("examples", examples ? true : nconf.get("examples"));

        // load defaults
        nconf.defaults(data);

        nconf.required(["platforms"]);

        nconf.set(
            "sockethub:host",
            process.env.HOST || nconf.get("sockethub:host"),
        );
        nconf.set(
            "sockethub:port",
            process.env.PORT || nconf.get("sockethub:port"),
        );

        // allow a redis://user:host:port url, takes precedence
        if (process.env.REDIS_URL) {
            nconf.set("redis:url", process.env.REDIS_URL);
        }

        // override logging config with environment variables if present
        nconf.set(
            "logging:level",
            process.env.LOG_LEVEL || nconf.get("logging:level"),
        );
        nconf.set(
            "logging:fileLevel",
            process.env.LOG_FILE_LEVEL || nconf.get("logging:fileLevel"),
        );
        nconf.set(
            "logging:file",
            process.env.LOG_FILE || nconf.get("logging:file"),
        );

        nconf.set(
            "platformHeartbeat:intervalMs",
            process.env.SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS ||
                nconf.get("platformHeartbeat:intervalMs"),
        );
        nconf.set(
            "platformHeartbeat:timeoutMs",
            process.env.SOCKETHUB_PLATFORM_HEARTBEAT_TIMEOUT_MS ||
                nconf.get("platformHeartbeat:timeoutMs"),
        );

        const parseBoolean = (value?: string) => {
            if (typeof value === "undefined") {
                return undefined;
            }
            const normalized = value.trim().toLowerCase();
            return (
                normalized === "true" ||
                normalized === "1" ||
                normalized === "yes"
            );
        };

        const parseNumber = (value?: string) => {
            if (typeof value === "undefined") {
                return undefined;
            }
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) {
                return undefined;
            }
            return parsed;
        };

        const httpEnabled = parseBoolean(
            process.env.SOCKETHUB_HTTP_ACTIONS_ENABLED,
        );
        if (typeof httpEnabled === "boolean") {
            nconf.set("httpActions:enabled", httpEnabled);
        }

        if (process.env.SOCKETHUB_HTTP_ACTIONS_PATH) {
            nconf.set(
                "httpActions:path",
                process.env.SOCKETHUB_HTTP_ACTIONS_PATH,
            );
        }

        const requireRequestId = parseBoolean(
            process.env.SOCKETHUB_HTTP_ACTIONS_REQUIRE_REQUEST_ID,
        );
        if (typeof requireRequestId === "boolean") {
            nconf.set("httpActions:requireRequestId", requireRequestId);
        }

        const maxMessagesPerRequest = parseNumber(
            process.env.SOCKETHUB_HTTP_ACTIONS_MAX_MESSAGES_PER_REQUEST,
        );
        if (typeof maxMessagesPerRequest === "number") {
            nconf.set(
                "httpActions:maxMessagesPerRequest",
                maxMessagesPerRequest,
            );
        }

        const maxPayloadBytes = parseNumber(
            process.env.SOCKETHUB_HTTP_ACTIONS_MAX_PAYLOAD_BYTES,
        );
        if (typeof maxPayloadBytes === "number") {
            nconf.set("httpActions:maxPayloadBytes", maxPayloadBytes);
        }

        const idempotencyTtlMs = parseNumber(
            process.env.SOCKETHUB_HTTP_ACTIONS_IDEMPOTENCY_TTL_MS,
        );
        if (typeof idempotencyTtlMs === "number") {
            nconf.set("httpActions:idempotencyTtlMs", idempotencyTtlMs);
        }

        const requestTimeoutMs = parseNumber(
            process.env.SOCKETHUB_HTTP_ACTIONS_REQUEST_TIMEOUT_MS,
        );
        if (typeof requestTimeoutMs === "number") {
            nconf.set("httpActions:requestTimeoutMs", requestTimeoutMs);
        }

        const idleTimeoutMs = parseNumber(
            process.env.SOCKETHUB_HTTP_ACTIONS_IDLE_TIMEOUT_MS,
        );
        if (typeof idleTimeoutMs === "number") {
            nconf.set("httpActions:idleTimeoutMs", idleTimeoutMs);
        }
    }
    get = (key: string) => nconf.get(key);
}

const config = new Config();
export default config;
