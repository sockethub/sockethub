import { fileURLToPath } from "node:url";
import chalk from "chalk";

import { type RedisConfig, redisCheck } from "@sockethub/data-layer";

import { createLogger } from "@sockethub/logger";
import { addPlatformSchema } from "@sockethub/schemas";
import type { Schema } from "ajv";
import config from "../config.js";
import loadPlatforms, {
    type PlatformMap,
    type PlatformStruct,
} from "./load-platforms.js";

const log = createLogger("server:bootstrap:init");

export interface IInitObject {
    version: string;
    platforms: PlatformMap;
}

let init: IInitObject;

function getExecutablePath(): string {
    // Primary: use the actual invoked script path
    if (process.argv[1]) {
        return process.argv[1];
    }
    // Fallback: resolve from import.meta.url
    return fileURLToPath(import.meta.url);
}

export function printSettingsInfo(
    version: string,
    platforms: Map<string, PlatformStruct>,
) {
    const execPath = getExecutablePath();

    console.log(`${chalk.cyan("sockethub")} ${version}`);
    console.log(`${chalk.cyan("executable:")} ${execPath}`);

    const wsUrl = `ws://${config.get("sockethub:host")}:${config.get("sockethub:port")}${config.get("sockethub:path")}`;
    console.log(`${chalk.cyan("websocket:")} ${chalk.blue(wsUrl)}`);

    const examplesUrl = `http://${config.get("public:host")}:${config.get(
        "public:port",
    )}${config.get("public:path")}`;
    console.log(
        `${chalk.cyan("examples:")} ${config.get("examples") ? chalk.blue(examplesUrl) : "disabled"}`,
    );

    console.log(
        `${chalk.cyan("redis URL:")} ${chalk.blue(config.get("redis:url"))}`,
    );

    console.log(
        `${chalk.cyan("platforms:")} ${Array.from(platforms.keys()).join(", ")}`,
    );

    if (platforms.size > 0) {
        for (const platform of platforms.values()) {
            console.log();
            console.log(chalk.green(`- ${platform.moduleName}`));
            console.log(` ${chalk.dim("version:")} ${platform.version}`);
            console.log(
                ` ${chalk.dim("AS types:")} ${platform.types.map((t) => chalk.yellow(t)).join(", ")}`,
            );
            if (platform.modulePath) {
                console.log(` ${chalk.dim("path:")} ${platform.modulePath}`);
            }
        }
    }
    console.log();
    process.exit();
}

let initCalled = false;
let initWaitCount = 0;
let cancelWait: NodeJS.Timeout | undefined;
const resolveQueue: Array<(init: IInitObject) => void> = [];

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
    for (const [, platform] of initObj.platforms) {
        const schemas = platform.schemas as unknown as Record<
            string,
            Schema | boolean | undefined
        >;
        for (const key of Object.keys(schemas)) {
            const schema = schemas[key];
            if (schema === undefined) {
                continue;
            }
            if (typeof schema !== "object" && typeof schema !== "boolean") {
                continue;
            }
            addPlatformSchema(schema, `${platform.id}/${key}`);
        }
    }
}

async function __loadInit(): Promise<IInitObject> {
    log.debug("running init routines");
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
    log.debug("finished init routines");
    return {
        version: version,
        platforms: platforms,
    };
}

export function __clearInit() {
    init = undefined;
    initCalled = false;
}
