import { beforeEach, describe, expect, it, mock } from "bun:test";
import getInitObject, {
    __clearInit,
    printSettingsInfo,
    type IInitObject,
} from "./init.js";
import { initMockFakePlatform } from "./init.test-helpers.js";

describe("platformLoad", () => {
    let loadInitMock;
    const platformName = "burgundy";

    beforeEach(async () => {
        loadInitMock = await initMockFakePlatform(platformName);
    });

    it("loads all platforms", async () => {
        const init = await getInitObject(loadInitMock);
        const expectedPlatforms = [platformName];
        expect(loadInitMock).toHaveBeenCalledTimes(1);
        expect(init.platforms.size).toEqual(expectedPlatforms.length);
        for (const platform of expectedPlatforms) {
            expect(init.platforms.has(platform)).toBeTrue();
        }
    });
});

describe("Init", () => {
    const initObject = {
        version: "init object",
        platforms: new Map(),
    } as IInitObject;
    let loadInitMock;

    beforeEach(() => {
        __clearInit();
        loadInitMock = mock(async () => {
            return Promise.resolve(initObject);
        });
    });

    it("getInitObject calls __loadInit", async () => {
        const i = await getInitObject(loadInitMock);
        expect(i).toEqual(initObject);
        expect(loadInitMock).toHaveBeenCalledTimes(1);
    });

    it("__loadInit is only called once", async () => {
        getInitObject(loadInitMock);
        getInitObject(loadInitMock);
        getInitObject(loadInitMock);
        getInitObject(loadInitMock);
        const i = await getInitObject(loadInitMock);
        expect(i).toEqual(initObject);
        expect(loadInitMock).toHaveBeenCalledTimes(1);
    });
});

describe("printSettingsInfo", () => {
    let logs: Array<string>;
    let exitCalled: boolean;
    let exitMock: () => never;
    let logMock: (message?: unknown, ...optionalParams: Array<unknown>) => void;

    beforeEach(() => {
        logs = [];
        exitCalled = false;
        logMock = (message?: unknown, ...optionalParams: Array<unknown>) => {
            const parts = [message, ...optionalParams].filter(
                (part) => typeof part !== "undefined",
            );
            logs.push(parts.map((part) => String(part)).join(" "));
        };
        exitMock = () => {
            exitCalled = true;
            throw new Error("exit called");
        };
    });

    it("displays sockethub version", () => {
        const platforms = new Map();
        expect(() =>
            printSettingsInfo("5.0.0-alpha.4", platforms, {
                log: logMock,
                exit: exitMock,
            }),
        ).toThrow("exit called");

        expect(logs.join("\n")).toMatch(/5\.0\.0-alpha\.4/);
    });

    it("displays executable path", () => {
        const platforms = new Map();
        expect(() =>
            printSettingsInfo("5.0.0", platforms, {
                log: logMock,
                exit: exitMock,
            }),
        ).toThrow("exit called");

        const output = logs.join("\n");
        expect(output).toMatch(/executable:/);
        expect(output).toMatch(/sockethub|init/);
    });

    it("displays platform information with colors", () => {
        const platforms = new Map([
            [
                "dummy",
                {
                    id: "dummy",
                    moduleName: "@sockethub/platform-dummy",
                    modulePath: "/path/to/dummy",
                    version: "1.0.0",
                    types: ["echo", "greet"],
                    config: {},
                    schemas: {
                        contextUrl:
                            "https://sockethub.org/ns/context/platform/dummy/v1.jsonld",
                        contextVersion: "1",
                        schemaVersion: "1",
                        credentials: {},
                        messages: {},
                    },
                    contextUrl:
                        "https://sockethub.org/ns/context/platform/dummy/v1.jsonld",
                    contextVersion: "1",
                    schemaVersion: "1",
                },
            ],
        ]);

        expect(() =>
            printSettingsInfo("5.0.0", platforms, {
                log: logMock,
                exit: exitMock,
            }),
        ).toThrow("exit called");

        const output = logs.join("\n");
        expect(output).toMatch(/platform-dummy/);
        expect(output).toMatch(/1\.0\.0/);
        expect(output).toMatch(/path.*dummy/);
    });

    it("calls process.exit after printing", () => {
        const platforms = new Map();
        expect(() =>
            printSettingsInfo("5.0.0", platforms, {
                log: logMock,
                exit: exitMock,
            }),
        ).toThrow("exit called");

        expect(exitCalled).toBeTrue();
    });

    it("strips colors in non-TTY environment", () => {
        // Chalk auto-detects, but we can test with NO_COLOR
        const oldNoColor = process.env.NO_COLOR;
        process.env.NO_COLOR = "1";

        const platforms = new Map();
        expect(() =>
            printSettingsInfo("5.0.0", platforms, {
                log: logMock,
                exit: exitMock,
            }),
        ).toThrow("exit called");
        const output = logs.join("\n");
        expect(output).not.toMatch(/\x1b\[/); // No ANSI escape codes

        process.env.NO_COLOR = oldNoColor;
    });
});
