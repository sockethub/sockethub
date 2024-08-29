import debug from "debug";

import config from "../config";
import loadPlatforms, { PlatformMap } from "./load-platforms";
import { redisCheck, RedisConfig } from "@sockethub/data-layer";

const log = debug("sockethub:server:bootstrap:init");

export interface IInitObject {
  version: string;
  platforms: PlatformMap;
}

let init: IInitObject;

function printSettingsInfo(version, platforms) {
  console.log("sockethub " + version);
  console.log();

  console.log(
    `websocket: ws://${config.get("sockethub:host")}:${
      config.get(
        "sockethub:port",
      )
    }${config.get("sockethub:path")}`,
  );

  console.log();
  const examplesUrl = `http://${config.get("public:host")}:${
    config.get(
      "public:port",
    )
  }${config.get("public:path")}`;
  console.log(
    `examples: ${config.get("examples:enabled") ? examplesUrl : "disabled"}`,
  );

  console.log();
  console.log("redis URL: " + config.get("redis:url"));

  console.log();
  console.log("platforms: " + Array.from(platforms.keys()).join(", "));

  if (platforms.size > 0) {
    for (const platform of platforms.values()) {
      console.log();
      console.log(platform.moduleName);
      console.log(` name: ${platform.id} version: ${platform.version}`);
      console.log(" AS types: " + platform.types.join(", "));
    }
  }
  console.log();
  process.exit();
}

let initCalled = false;
export default async function getInitObject(
  initFunc = __loadInit,
): Promise<IInitObject> {
  return new Promise((resolve, reject) => {
    if (initCalled) {
      setTimeout(() => {
        if (!init) {
          reject("failed to initialize");
        } else {
          resolve(init);
        }
      }, 500);
    } else {
      initCalled = true;
      if (init) {
        resolve(init);
      } else {
        initFunc().then((_init) => {
          init = _init;
          resolve(init);
        });
      }
    }
  });
}

async function __loadInit(): Promise<IInitObject> {
  log("running init routines");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const packageJSON = require("./../../package.json");
  const version = packageJSON.version;
  const platforms = await loadPlatforms(
    config.get("platforms") as Array<string>,
  );

  await redisCheck(config.get("redis") as RedisConfig);

  if (config.get("info")) {
    printSettingsInfo(packageJSON.version, platforms);
  }
  log("finished init routines");
  return {
    version: version,
    platforms: platforms,
  };
}

export function __clearInit() {
  init = undefined;
  initCalled = false;
}
