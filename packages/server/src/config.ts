import nconf from "nconf";
import debug from "debug";
import * as fs from "fs";

import { __dirname } from "./util.js";
import path from "path";

const log = debug("sockethub:server:bootstrap:config");
const data: object = await import(__dirname + "/defaults.json", {
    with: { type: "json" },
});

export class Config {
    constructor() {
        log("initializing config");
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
                default: "",
                describe: "Path to sockethub.config.json",
            },
            port: {
                alias: "sockethub.port",
            },
            host: {
                alias: "sockethub.host",
            },
            redis_url: {
                alias: "redis.url",
            },
        });

        // get value of flags defined by any command-line params
        const examples = nconf.get("examples");

        // Load the main config
        let configFile = nconf.get("config");
        if (configFile) {
            configFile = path.resolve(configFile);
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            if (!fs.existsSync(configFile)) {
                throw new Error(`Config file not found: ${configFile}`);
            }
            log(`reading config file at ${configFile}`);
            nconf.file(configFile);
        } else {
            log("No config file specified, using defaults");
            console.log("No config file specified, using defaults");
            nconf.use("memory");
        }

        // only override config file if explicitly mentioned in command-line params
        nconf.set(
            "examples:enabled",
            examples ? true : nconf.get("examples:enabled"),
        );

        // load defaults
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        nconf.defaults(data.default);

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
    get = (key: string): unknown => nconf.get(key);
}

const config = new Config();
export default config;
