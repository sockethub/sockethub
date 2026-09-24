import { afterEach, describe, expect, it } from "vitest";
import { get } from "svelte/store";
import {
    apiDiscovery,
    describeDiscoveryFailure,
    serverBaseUrl,
} from "./api-discovery";

afterEach(() => {
    apiDiscovery.set(undefined);
});

describe("api discovery", () => {
    it("starts undefined while discovery is in flight", () => {
        expect(get(apiDiscovery)).toBeUndefined();
    });

    it("uses the origin the app was loaded from as the server base URL", () => {
        expect(serverBaseUrl({ origin: "https://sh.example.org" })).toBe(
            "https://sh.example.org",
        );
    });

    it("has no base URL for opaque origins or outside a browser", () => {
        expect(serverBaseUrl({ origin: "null" })).toBeUndefined();
        expect(serverBaseUrl({})).toBeUndefined();
        expect(serverBaseUrl(undefined)).toBeUndefined();
    });

    it("describes failures by their message", () => {
        expect(describeDiscoveryFailure(new Error("boom"))).toBe("boom");
        expect(describeDiscoveryFailure("plain")).toBe("plain");
    });
});
