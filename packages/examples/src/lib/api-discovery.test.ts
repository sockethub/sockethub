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
        expect(
            serverBaseUrl({ origin: "https://sh.example.org" }, undefined),
        ).toBe("https://sh.example.org");
    });

    it("has no base URL for opaque origins or outside a browser", () => {
        expect(serverBaseUrl({ origin: "null" }, undefined)).toBeUndefined();
        expect(serverBaseUrl({}, undefined)).toBeUndefined();
        expect(serverBaseUrl(undefined, undefined)).toBeUndefined();
    });

    it("prefers a VITE_SOCKETHUB_URL override for standalone development", () => {
        expect(
            serverBaseUrl(
                { origin: "http://localhost:10551" },
                " http://localhost:10550 ",
            ),
        ).toBe("http://localhost:10550");
        expect(
            serverBaseUrl({ origin: "http://localhost:10551" }, ""),
        ).toBe("http://localhost:10551");
    });

    it("describes failures by their message", () => {
        expect(describeDiscoveryFailure(new Error("boom"))).toBe("boom");
        expect(describeDiscoveryFailure("plain")).toBe("plain");
    });
});
