import { describe, expect, it } from "bun:test";
import { validateServiceDescriptor } from "@sockethub/schemas";
import {
    buildServiceDescriptor,
    publicEndpoints,
    sortedPlatforms,
} from "./api-info.js";
import type { PlatformMap } from "./bootstrap/load-platforms.js";
import { SOCKETHUB_API_VERSION, SOCKETHUB_VERSION } from "./version.js";

const platforms: PlatformMap = new Map([
    [
        "dummy",
        {
            id: "dummy",
            moduleName: "@sockethub/platform-dummy",
            config: { persist: false },
            schemas: { name: "dummy", version: "3.0.0", messages: {} },
            version: "3.0.0-alpha.25",
            apiVersion: 3,
            contextUrl: "https://sockethub.org/ns/v/context/platform/dummy",
            contextVersion: "1",
            schemaVersion: "1",
            types: ["echo"],
        },
    ],
] as Array<[string, PlatformMap extends Map<string, infer V> ? V : never]>);

const defaults: Record<string, unknown> = {
    "public:protocol": "http",
    "public:host": "localhost",
    "public:port": 10550,
    "sockethub:path": "/sockethub",
    "httpActions:enabled": false,
    "httpActions:path": "/sockethub-http",
};

function getConfigWith(overrides: Record<string, unknown> = {}) {
    const values = { ...defaults, ...overrides };
    return (key: string) => values[key];
}

describe("api-info", () => {
    describe("publicEndpoints", () => {
        it("advertises paths only, without an origin", () => {
            expect(publicEndpoints(getConfigWith())).toEqual({
                socketIO: "/sockethub",
            });
        });

        it("adds the HTTP actions path when enabled", () => {
            expect(
                publicEndpoints(
                    getConfigWith({
                        "httpActions:enabled": true,
                        "httpActions:path": "/actions",
                    }),
                ),
            ).toEqual({ socketIO: "/sockethub", httpActions: "/actions" });
        });

        it("falls back to the root path when no Socket.IO path is set", () => {
            expect(
                publicEndpoints(getConfigWith({ "sockethub:path": "" })).socketIO,
            ).toBe("/");
        });

        it("omits httpActions when enabled without a path", () => {
            expect(
                publicEndpoints(
                    getConfigWith({
                        "httpActions:enabled": true,
                        "httpActions:path": "",
                    }),
                ).httpActions,
            ).toBeUndefined();
        });
    });

    describe("sortedPlatforms", () => {
        const entry = (id: string) =>
            [id, { ...platforms.get("dummy"), id }] as [
                string,
                PlatformMap extends Map<string, infer V> ? V : never,
            ];

        it("puts dummy first and the rest in alphabetical order", () => {
            const loaded: PlatformMap = new Map(
                ["xmpp", "feeds", "dummy", "caldav", "irc", "carddav"].map(entry),
            );
            expect(sortedPlatforms(loaded).map((p) => p.id)).toEqual([
                "dummy",
                "caldav",
                "carddav",
                "feeds",
                "irc",
                "xmpp",
            ]);
        });

        it("sorts alphabetically when dummy is not loaded", () => {
            const loaded: PlatformMap = new Map(
                ["metadata", "caldav"].map(entry),
            );
            expect(sortedPlatforms(loaded).map((p) => p.id)).toEqual([
                "caldav",
                "metadata",
            ]);
        });
    });

    describe("buildServiceDescriptor", () => {
        it("builds a valid descriptor with endpoints and platforms", () => {
            const descriptor = buildServiceDescriptor(
                platforms,
                getConfigWith({
                    "public:protocol": "https",
                    "public:host": "sh.example.org",
                    "public:port": 443,
                    "httpActions:enabled": true,
                }),
            );
            expect(validateServiceDescriptor(descriptor)).toBeTrue();
            expect(descriptor).toEqual({
                name: "sockethub",
                apiVersion: SOCKETHUB_API_VERSION,
                endpoints: {
                    socketIO: "/sockethub",
                    httpActions: "/sockethub-http",
                },
                platforms: [{ id: "dummy", apiVersion: 3 }],
            });
            expect(JSON.stringify(descriptor)).not.toContain(SOCKETHUB_VERSION);
        });
    });
});
