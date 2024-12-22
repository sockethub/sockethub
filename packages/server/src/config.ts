import nconf from "nconf";
import debug from "debug";
import * as fs from "node:fs";
import defaults from "./defaults.json" with { type: "json" };

const log = debug("sockethub:server:bootstrap:config");


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
        describe: "Enable the examples pages served at [host]:[port]/examples",
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
    nconf.env();

    // get value of flags defined by any command-line params
    const examples = nconf.get("examples");

    // Load the main config
    let configFile = nconf.get("config");
    if (configFile) {
      if (!fs.existsSync(configFile)) {
        throw new Error(`Config file not found: ${configFile}`);
      }
    } else {
      configFile = "./../sockethub.config.json";
    }
    nconf.file(configFile);

    // only override config file if explicitly mentioned in command-line params
    nconf.set(
      "examples:enabled",
      examples ? true : nconf.get("examples:enabled"),
    );

    // load defaults;
    nconf.defaults(defaults);

    nconf.required(["platforms"]);

    nconf.set(
      "sockethub:host",
      Deno.env.get("HOST") || nconf.get("sockethub:host"),
    );
    nconf.set(
      "sockethub:port",
      Deno.env.get("PORT") || nconf.get("sockethub:port"),
    );

    // allow a redis://user:host:port url, takes precedence
    if (Deno.env.get("REDIS_URL")) {
      nconf.set("redis:url", Deno.env.get("REDIS_URL"));
    }
  }
  get = (key: string): unknown => nconf.get(key);
}

const config = new Config();
export default config;
