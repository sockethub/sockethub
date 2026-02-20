import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as sinon from "sinon";
import getInitObject, {
    __clearInit,
    printSettingsInfo,
    type IInitObject,
} from "./init.js";
import loadPlatforms from "./load-platforms.js";

function getFakePlatform(name: string) {
    return class FakeSockethubPlatform {
        get config() {
            return {};
        }

        get schema() {
            return {
                name: name,
                version: "0.0.1",
                as2: {
                    contextUrl: `https://sockethub.org/ns/context/platform/${name}/v1.jsonld`,
                    contextVersion: "1",
                    schemaVersion: "1",
                },
                credentials: {
                    required: ["object"],
                    properties: {
                        actor: {
                            type: "object",
                            required: ["id"],
                        },
                        object: {
                            type: "object",
                            required: ["type", "user", "pass"],
                            additionalProperties: false,
                            properties: {
                                type: {
                                    type: "string",
                                },
                                user: {
                                    type: "string",
                                },
                                pass: {
                                    type: "string",
                                },
                            },
                        },
                    },
                },
                messages: {
                    required: ["type"],
                    properties: {
                        type: {
                            enum: ["echo", "fail"],
                        },
                    },
                },
            };
        }
    };
}

export async function initMockFakePlatform(platformName: string) {
    const initObject = {
        version: "init object",
        platforms: new Map(),
    } as IInitObject;
    __clearInit();
    const initFunc = async () => {
        const modules = {};
        modules[platformName] = getFakePlatform(platformName);
        initObject.platforms = await loadPlatforms(
            [platformName],
            async (module) => {
                return Promise.resolve(modules[module]);
            },
        );
        return Promise.resolve(initObject);
    };
    return mock(initFunc);
}

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
    let logSpy: sinon.SinonSpy;
    let exitStub: sinon.SinonStub;

    beforeEach(() => {
        logSpy = sinon.spy(console, "log");
        exitStub = sinon.stub(process, "exit");
    });

    afterEach(() => {
        sinon.restore();
    });

    it("displays sockethub version", () => {
        const platforms = new Map();
        printSettingsInfo("5.0.0-alpha.4", platforms);

        // Check for version in output (may have color codes)
        sinon.assert.calledWithMatch(logSpy, sinon.match(/5\.0\.0-alpha\.4/));
    });

    it("displays executable path", () => {
        const platforms = new Map();
        printSettingsInfo("5.0.0", platforms);

        sinon.assert.calledWithMatch(logSpy, sinon.match(/executable:/));
        sinon.assert.calledWithMatch(logSpy, sinon.match(/sockethub|init/));
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
                        as2: {
                            contextUrl:
                                "https://sockethub.org/ns/context/platform/dummy/v1.jsonld",
                            contextVersion: "1",
                            schemaVersion: "1",
                        },
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

        printSettingsInfo("5.0.0", platforms);

        // Verify platform name appears
        sinon.assert.calledWithMatch(
            logSpy,
            sinon.match(/platform-dummy/),
        );
        // Verify version appears
        sinon.assert.calledWithMatch(logSpy, sinon.match(/1\.0\.0/));
        // Verify path appears
        sinon.assert.calledWithMatch(logSpy, sinon.match(/path.*dummy/));
    });

    it("calls process.exit after printing", () => {
        const platforms = new Map();
        printSettingsInfo("5.0.0", platforms);

        sinon.assert.calledOnce(exitStub);
    });

    it("strips colors in non-TTY environment", () => {
        // Chalk auto-detects, but we can test with NO_COLOR
        const oldNoColor = process.env.NO_COLOR;
        process.env.NO_COLOR = "1";

        const platforms = new Map();
        printSettingsInfo("5.0.0", platforms);

        // Output should not contain ANSI codes
        const calls = logSpy.getCalls();
        const output = calls.map((c) => c.args[0]).join("\n");
        expect(output).not.toMatch(/\x1b\[/); // No ANSI escape codes

        process.env.NO_COLOR = oldNoColor;
    });
});
