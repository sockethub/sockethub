import { describe, expect, it } from "bun:test";
import { validateServiceDescriptor } from "@sockethub/schemas";
import {
    buildServiceDescriptor,
    publicEndpoints,
    publicOrigin,
    publicSocketEndpoint,
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
    describe("publicOrigin", () => {
        it("includes a non-default port", () => {
            expect(publicOrigin(getConfigWith())).toBe("http://localhost:10550");
        });

        it("omits the protocol default port for http and https", () => {
            expect(
                publicOrigin(
                    getConfigWith({ "public:port": 80, "public:host": "a.example" }),
                ),
            ).toBe("http://a.example");
            expect(
                publicOrigin(
                    getConfigWith({
                        "public:protocol": "https",
                        "public:host": "sh.example.org",
                        "public:port": 443,
                    }),
                ),
            ).toBe("https://sh.example.org");
        });

        it("keeps a non-default https port", () => {
            expect(
                publicOrigin(
                    getConfigWith({
                        "public:protocol": "https",
                        "public:host": "sh.example.org",
                        "public:port": 8443,
                    }),
                ),
            ).toBe("https://sh.example.org:8443");
        });

        it("falls back to http://localhost when public settings are missing", () => {
            expect(publicOrigin(() => undefined)).toBe("http://localhost");
        });
    });

    describe("publicSocketEndpoint", () => {
        it("keeps the Socket.IO path separate from the origin", () => {
            expect(publicSocketEndpoint(getConfigWith())).toEqual({
                origin: "http://localhost:10550",
                path: "/sockethub",
            });
        });

        it("reflects a custom path", () => {
            expect(
                publicSocketEndpoint(getConfigWith({ "sockethub:path": "/ws" }))
                    .path,
            ).toBe("/ws");
        });
    });

    describe("publicEndpoints", () => {
        it("omits httpActions when disabled", () => {
            expect(publicEndpoints(getConfigWith())).toEqual({
                socket: { origin: "http://localhost:10550", path: "/sockethub" },
            });
        });

        it("adds the absolute HTTP actions URL when enabled", () => {
            expect(
                publicEndpoints(
                    getConfigWith({
                        "httpActions:enabled": true,
                        "httpActions:path": "/actions",
                    }),
                ),
            ).toEqual({
                socket: { origin: "http://localhost:10550", path: "/sockethub" },
                httpActions: "http://localhost:10550/actions",
            });
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
                    socket: { origin: "https://sh.example.org", path: "/sockethub" },
                    httpActions: "https://sh.example.org/sockethub-http",
                },
                platforms: [{ id: "dummy", apiVersion: 3 }],
            });
            expect(JSON.stringify(descriptor)).not.toContain(SOCKETHUB_VERSION);
        });
    });
});
