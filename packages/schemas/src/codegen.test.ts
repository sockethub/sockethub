import { afterEach, describe, expect, it } from "bun:test";
import { setCodegenAvailableForTesting } from "./helpers/codegen.js";
import { validateServiceDescriptor } from "./service-descriptor.js";
import type { ActivityStream } from "./types.js";
import { validateActivityStream, validateCredentials } from "./validator.js";

const descriptor = {
    name: "sockethub",
    apiVersion: 5,
    endpoints: { socketIO: "/sockethub" },
    platforms: [{ id: "caldav", apiVersion: 1 }],
};

// Only used to assert validation is skipped, so these need not be schema-valid.
const activity = {
    "@context": ["a", "b", "c"],
    type: "send",
    actor: { id: "x", type: "person" },
} as unknown as ActivityStream;

const credentials = {
    "@context": ["a", "b", "c"],
    type: "credentials",
    actor: { id: "x", type: "person" },
} as unknown as ActivityStream;

describe("codegen fallback (CSP without unsafe-eval)", () => {
    afterEach(() => {
        setCodegenAvailableForTesting(undefined);
    });

    it("accepts a valid descriptor without Ajv", () => {
        setCodegenAvailableForTesting(false);
        expect(validateServiceDescriptor(descriptor)).toBeTrue();
    });

    it("rejects a malformed descriptor without Ajv", () => {
        setCodegenAvailableForTesting(false);
        for (const bad of [
            null,
            "sockethub",
            {},
            { ...descriptor, name: "other" },
            { ...descriptor, apiVersion: 1.5 },
            { ...descriptor, endpoints: {} },
            { ...descriptor, endpoints: { socketIO: "//other.example/x" } },
            { ...descriptor, platforms: [{ apiVersion: 1 }] },
        ]) {
            expect(validateServiceDescriptor(bad)).toBeFalse();
        }
    });

    it("skips activity stream and credential validation", () => {
        setCodegenAvailableForTesting(false);
        expect(validateActivityStream(activity)).toBe("");
        expect(validateCredentials(credentials)).toBe("");
    });
});
