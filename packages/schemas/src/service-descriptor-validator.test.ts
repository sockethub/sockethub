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
    const endpoints = { socketIO: "/sockethub", httpActions: "/sockethub-http" };

    it("accepts a descriptor with Socket.IO and HTTP actions paths", () => {
        expect(
            validateServiceDescriptor({ ...validDescriptor, endpoints }),
        ).toBeTrue();
    });

    it("accepts endpoints without HTTP actions", () => {
        expect(
            validateServiceDescriptor({
                ...validDescriptor,
                endpoints: { socketIO: "/sockethub" },
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
                endpoints: { ...endpoints, webhooks: "/hooks" },
            }),
        ).toBeTrue();
    });

    it("rejects endpoints without a Socket.IO path", () => {
        expect(
            validateServiceDescriptor({
                ...validDescriptor,
                endpoints: { httpActions: "/sockethub-http" },
            }),
        ).toBeFalse();
    });

    for (const socketIO of [
        "",
        "sockethub",
        "//other.example/sockethub",
        "/\\other.example/sockethub",
        "https://sh.example.org/sockethub",
        { origin: "https://sh.example.org", path: "/sockethub" },
        42,
    ]) {
        it(`rejects Socket.IO endpoint ${JSON.stringify(socketIO)}`, () => {
            expect(
                validateServiceDescriptor({
                    ...validDescriptor,
                    endpoints: { socketIO },
                }),
            ).toBeFalse();
        });
    }

    for (const httpActions of [
        "",
        "sockethub-http",
        "//other.example/sockethub-http",
        "/\\other.example/sockethub-http",
        "https://sh.example.org/sockethub-http",
        42,
    ]) {
        it(`rejects HTTP actions endpoint ${JSON.stringify(httpActions)}`, () => {
            expect(
                validateServiceDescriptor({
                    ...validDescriptor,
                    endpoints: { socketIO: "/sockethub", httpActions },
                }),
            ).toBeFalse();
        });
    }
});
