import debug from "debug";

import { redisCheck, RedisConfig } from "@sockethub/data-layer";

import config from "../config.js";
import loadPlatforms, { PlatformMap } from "./load-platforms.js";
import { addPlatformSchema } from "@sockethub/schemas";

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
        `websocket: ws://${config.get("sockethub:host")}:${config.get(
            "sockethub:port",
        )}${config.get("sockethub:path")}`,
    );

    console.log();
    const examplesUrl = `http://${config.get("public:host")}:${config.get(
        "public:port",
    )}${config.get("public:path")}`;
    console.log(
        `examples: ${
            config.get("examples:enabled") ? examplesUrl : "disabled"
        }`,
    );

    console.log();
    console.log("redis URL: " + config.get("redis:url"));

    console.log();
    console.log("platforms: " + Array.from(platforms.keys()).join(", "));

    if (platforms.size > 0) {
        for (const platform of platforms.values()) {
            console.log();
            console.log(`- ${platform.moduleName}`);
            console.log(` name: ${platform.id} version: ${platform.version}`);
            console.log(" AS types: " + platform.types.join(", "));
        }
    }
    console.log();
    process.exit();
}

let initCalled = false;
let initWaitCount = 0;
let cancelWait: NodeJS.Timeout;
const resolveQueue = [];

export default async function getInitObject(
    initFunc: () => Promise<IInitObject> = __loadInit,
): Promise<IInitObject> {
    return new Promise((resolve, reject) => {
        if (initCalled) {
            if (init) {
                resolve(init);
            } else if (!cancelWait) {
                cancelWait = setInterval(() => {
                    if (!init) {
                        if (initWaitCount > 10) {
                            reject("failed to initialize");
                        }
                        initWaitCount++;
                    } else {
                        clearInterval(cancelWait);
                        resolve(init);
                        for (const resolve of resolveQueue) {
                            resolve(init);
                        }
                    }
                }, 1000);
            } else {
                resolveQueue.push(resolve);
            }
        } else {
            initCalled = true;
            if (init) {
                resolve(init);
            } else {
                initFunc()
                    .then((_init) => {
                        init = _init;
                        return registerPlatforms(_init);
                    })
                    .then(() => {
                        resolve(init);
                    });
            }
        }
    });
}

export async function registerPlatforms(initObj: IInitObject): Promise<void> {
    initObj.platforms.forEach((platform) => {
        Object.keys(platform.schemas).forEach((key) => {
            if (!platform.schemas[key]) {
                return;
            }
            addPlatformSchema(platform.schemas[key], `${platform.id}/${key}`);
        });
    });
}

async function __loadInit(): Promise<IInitObject> {
    log("running init routines");
    const packageJSON = await import("./../../package.json", {
        with: { type: "json" },
    });
    const version = packageJSON.default.version;
    const platforms = await loadPlatforms(
        config.get("platforms") as Array<string>,
    );

    await redisCheck(config.get("redis") as RedisConfig);

    if (config.get("info")) {
        printSettingsInfo(packageJSON.default.version, platforms);
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
