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
