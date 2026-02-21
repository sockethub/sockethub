import { mock } from "bun:test";
import type { IInitObject } from "./init.js";
import { __clearInit } from "./init.js";
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
