import { expect, describe, it, beforeEach, mock } from "bun:test";
import getInitObject, { __clearInit, IInitObject } from "./init.js";
import loadPlatforms from "./load-platforms.js";

function getFakePlatform(name: string) {
    return class FakeSockethubPlatform {
        constructor() {}

        get config() {
            return {};
        }

        get schema() {
            return {
                name: name,
                version: "0.0.1",
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
