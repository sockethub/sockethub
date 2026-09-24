import { describe, expect, it } from "bun:test";
import { validateServiceDescriptor } from "./service-descriptor.js";

const validDescriptor = {
    name: "sockethub",
    apiVersion: 5,
    platforms: [
        { id: "metadata", apiVersion: 1 },
        { id: "caldav", apiVersion: 0 },
    ],
};

describe("validateServiceDescriptor", () => {
    it("accepts a valid descriptor", () => {
        expect(validateServiceDescriptor(validDescriptor)).toBeTrue();
    });

    it("accepts a descriptor with no platforms", () => {
        expect(
            validateServiceDescriptor({ ...validDescriptor, platforms: [] }),
        ).toBeTrue();
    });

    it("accepts members added by a later server", () => {
        expect(
            validateServiceDescriptor({
                ...validDescriptor,
                documentation: "https://sockethub.org",
                platforms: [{ id: "metadata", apiVersion: 1, label: "Metadata" }],
            }),
        ).toBeTrue();
    });

    for (const apiVersion of [-1, 1.5, "5", null, undefined]) {
        it(`rejects global apiVersion ${String(apiVersion)}`, () => {
            expect(
                validateServiceDescriptor({ ...validDescriptor, apiVersion }),
            ).toBeFalse();
        });

        it(`rejects platform apiVersion ${String(apiVersion)}`, () => {
            expect(
                validateServiceDescriptor({
                    ...validDescriptor,
                    platforms: [{ id: "metadata", apiVersion }],
                }),
            ).toBeFalse();
        });
    }

    it("rejects a descriptor for another service", () => {
        expect(
            validateServiceDescriptor({ ...validDescriptor, name: "other" }),
        ).toBeFalse();
    });

    it("rejects a platform without an id", () => {
        expect(
            validateServiceDescriptor({
                ...validDescriptor,
                platforms: [{ apiVersion: 1 }, { id: "", apiVersion: 1 }],
            }),
        ).toBeFalse();
    });

    it("rejects non-objects and missing members", () => {
        for (const bad of [null, "sockethub", [], {}, { name: "sockethub" }]) {
            expect(validateServiceDescriptor(bad)).toBeFalse();
        }
    });
});

describe("validateServiceDescriptor endpoints", () => {
    const endpoints = {
        socket: { origin: "https://sh.example.org", path: "/sockethub" },
        httpActions: "https://sh.example.org/sockethub-http",
    };

    it("accepts a descriptor with socket and HTTP actions endpoints", () => {
        expect(
            validateServiceDescriptor({ ...validDescriptor, endpoints }),
        ).toBeTrue();
    });

    it("accepts endpoints without HTTP actions", () => {
        expect(
            validateServiceDescriptor({
                ...validDescriptor,
                endpoints: { socket: endpoints.socket },
            }),
        ).toBeTrue();
    });

    it("accepts a descriptor without endpoints, as written by older servers", () => {
        expect(validateServiceDescriptor(validDescriptor)).toBeTrue();
    });

    it("accepts endpoint members added by a later server", () => {
        expect(
            validateServiceDescriptor({
                ...validDescriptor,
                endpoints: {
                    ...endpoints,
                    socket: { ...endpoints.socket, transports: ["websocket"] },
                    webhooks: "https://sh.example.org/hooks",
                },
            }),
        ).toBeTrue();
    });

    it("rejects a socket origin that is not a bare http(s) origin", () => {
        for (const origin of [
            "ftp://sh.example.org",
            "javascript:alert(1)",
            "https://sh.example.org/sockethub",
            "sh.example.org",
            "",
        ]) {
            expect(
                validateServiceDescriptor({
                    ...validDescriptor,
                    endpoints: { socket: { origin, path: "/sockethub" } },
                }),
            ).toBeFalse();
        }
    });

    it("rejects endpoints without a socket transport", () => {
        expect(
            validateServiceDescriptor({
                ...validDescriptor,
                endpoints: { httpActions: endpoints.httpActions },
            }),
        ).toBeFalse();
    });

    for (const socket of [
        { origin: "https://sh.example.org" },
        { path: "/sockethub" },
        { origin: "", path: "/sockethub" },
        { origin: "https://sh.example.org", path: "" },
        "https://sh.example.org/sockethub",
    ]) {
        it(`rejects socket endpoint ${JSON.stringify(socket)}`, () => {
            expect(
                validateServiceDescriptor({
                    ...validDescriptor,
                    endpoints: { socket },
                }),
            ).toBeFalse();
        });
    }

    for (const httpActions of ["", 42, { url: "https://sh.example.org" }]) {
        it(`rejects httpActions endpoint ${JSON.stringify(httpActions)}`, () => {
            expect(
                validateServiceDescriptor({
                    ...validDescriptor,
                    endpoints: { socket: endpoints.socket, httpActions },
                }),
            ).toBeFalse();
        });
    }
});
