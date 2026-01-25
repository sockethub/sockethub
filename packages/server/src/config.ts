import fs from "node:fs";
import path from "node:path";
import nconf from "nconf";

import { createLogger } from "./logger.js";
import { __dirname } from "./util.js";

const log = createLogger({ namespace: "sockethub:server:bootstrap:config" });
const data = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "defaults.json"), "utf-8"),
);

const defaultConfig = "sockethub.config.json";

export class Config {
    constructor() {
        log.debug("initializing config");
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
            log.debug(`reading config file at ${configFile}`);
            nconf.file(configFile);
        } else {
            if (fs.existsSync(`${process.cwd()}/${defaultConfig}`)) {
                log.debug(`loading local ${defaultConfig}`);
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
    }
    get = (key: string) => nconf.get(key);
}

const config = new Config();
export default config;
