import { fileURLToPath } from "node:url";
import { type RedisConfig, redisCheck } from "@sockethub/data-layer";
import { createLogger } from "@sockethub/logger";
import {
    addPlatformContext,
    addPlatformSchema,
    InternalObjectTypesList,
    setValidationErrorOptions,
} from "@sockethub/schemas";
import chalk from "chalk";
import config from "../config.js";
import loadPlatforms, {
    type PlatformMap,
    type PlatformSchemaRegistry,
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
    options?: {
        log?: (message?: unknown, ...optionalParams: Array<unknown>) => void;
        exit?: (code?: number | string | null) => never;
    },
) {
    const execPath = getExecutablePath();
    // Allow callers (primarily tests) to inject logger/exit shims so this
    // function can be asserted without printing to stdout or exiting the process.
    const logInfo = options?.log ?? console.log;
    const exit = options?.exit ?? process.exit;

    logInfo(`${chalk.cyan("sockethub")} ${version}`);
    logInfo(`${chalk.cyan("executable:")} ${execPath}`);

    const wsUrl = `ws://${config.get("sockethub:host")}:${config.get("sockethub:port")}${config.get("sockethub:path")}`;
    logInfo(`${chalk.cyan("websocket:")} ${chalk.blue(wsUrl)}`);

    const examplesUrl = `http://${config.get("public:host")}:${config.get(
        "public:port",
    )}${config.get("public:path")}`;
    logInfo(
        `${chalk.cyan("examples:")} ${config.get("examples") ? chalk.blue(examplesUrl) : "disabled"}`,
    );

    logInfo(
        `${chalk.cyan("redis URL:")} ${chalk.blue(config.get("redis:url"))}`,
    );

    logInfo(
        `${chalk.cyan("platforms:")} ${Array.from(platforms.keys()).join(", ")}`,
    );

    if (platforms.size > 0) {
        for (const platform of platforms.values()) {
            logInfo("");
            logInfo(chalk.green(`- ${platform.moduleName}`));
            logInfo(` ${chalk.dim("version:")} ${platform.version}`);
            logInfo(
                ` ${chalk.dim("AS types:")} ${platform.types.map((t) => chalk.yellow(t)).join(", ")}`,
            );
            if (platform.modulePath) {
                logInfo(` ${chalk.dim("path:")} ${platform.modulePath}`);
            }
        }
    }
    logInfo("");
    exit();
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
                setValidationErrorOptions({
                    excludeTypes: InternalObjectTypesList,
                });
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
    for (const [_platformId, platform] of initObj.platforms) {
        const schemas: PlatformSchemaRegistry = platform.schemas;
        addPlatformContext(platform.id, platform.contextUrl);
        if (schemas.credentials !== undefined) {
            addPlatformSchema(
                schemas.credentials,
                `${platform.id}/credentials`,
            );
        }
        if (schemas.messages !== undefined) {
            addPlatformSchema(schemas.messages, `${platform.id}/messages`);
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
    initWaitCount = 0;
    resolveQueue.length = 0;
    if (cancelWait) {
        clearInterval(cancelWait);
        cancelWait = undefined;
    }
}
