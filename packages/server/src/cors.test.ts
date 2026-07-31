import { describe, expect, it } from "bun:test";
import { parseCorsOrigins, resolveAllowedOrigin } from "./cors.js";

describe("parseCorsOrigins", () => {
    it("returns * when unset, empty, or configured as *", () => {
        expect(parseCorsOrigins(undefined)).toBe("*");
        expect(parseCorsOrigins("")).toBe("*");
        expect(parseCorsOrigins("   ")).toBe("*");
        expect(parseCorsOrigins("*")).toBe("*");
    });

    it("parses a single origin into a one-entry list", () => {
        expect(parseCorsOrigins("https://app.example.com")).toEqual([
            "https://app.example.com",
        ]);
    });

    it("parses a comma-separated list, trimming whitespace", () => {
        expect(
            parseCorsOrigins(" https://a.example , https://b.example:8080 "),
        ).toEqual(["https://a.example", "https://b.example:8080"]);
    });

    it("normalizes to the browser Origin serialization", () => {
        expect(
            parseCorsOrigins(
                "https://App.Example.com/, http://a.example:80, https://b.example/path",
            ),
        ).toEqual([
            "https://app.example.com",
            "http://a.example",
            "https://b.example",
        ]);
    });

    it("deduplicates entries that normalize to the same origin", () => {
        expect(
            parseCorsOrigins("https://a.example, https://A.example/"),
        ).toEqual(["https://a.example"]);
    });

    it("drops entries that are not valid URLs", () => {
        expect(
            parseCorsOrigins("app.example.com, https://b.example"),
        ).toEqual(["https://b.example"]);
    });

    it("drops entries with an opaque origin", () => {
        expect(
            parseCorsOrigins("file:///etc/passwd, https://b.example"),
        ).toEqual(["https://b.example"]);
    });

    it("treats a list containing * as allow-any", () => {
        expect(parseCorsOrigins("https://a.example, *")).toBe("*");
    });

    it("fails closed when a restrictive config has no valid origins", () => {
        expect(parseCorsOrigins(",,,")).toEqual([]);
        expect(parseCorsOrigins("not a url")).toEqual([]);
    });
});

describe("resolveAllowedOrigin", () => {
    it("returns * when any origin is allowed", () => {
        expect(resolveAllowedOrigin("*", "https://app.example")).toBe("*");
        expect(resolveAllowedOrigin("*", undefined)).toBe("*");
    });

    it("echoes a request origin that is in the allow-list", () => {
        expect(
            resolveAllowedOrigin(
                ["https://a.example", "https://b.example"],
                "https://b.example",
            ),
        ).toBe("https://b.example");
    });

    it("returns undefined for an origin not in the allow-list", () => {
        expect(
            resolveAllowedOrigin(["https://a.example"], "https://evil.example"),
        ).toBeUndefined();
    });

    it("returns undefined for a restricted list when no origin is sent", () => {
        expect(
            resolveAllowedOrigin(["https://a.example"], undefined),
        ).toBeUndefined();
    });

    it("normalizes the request origin before matching", () => {
        expect(
            resolveAllowedOrigin(
                ["https://a.example"],
                "https://A.example:443",
            ),
        ).toBe("https://A.example:443");
    });

    it("returns undefined for a malformed or opaque request origin", () => {
        expect(
            resolveAllowedOrigin(["https://a.example"], "not a url"),
        ).toBeUndefined();
        expect(
            resolveAllowedOrigin(["https://a.example"], "null"),
        ).toBeUndefined();
    });

    it("fails closed against an empty allow-list", () => {
        expect(
            resolveAllowedOrigin(
                parseCorsOrigins(",,,"),
                "https://app.example.com",
            ),
        ).toBeUndefined();
    });

    it("matches configured origins that needed normalizing", () => {
        expect(
            resolveAllowedOrigin(
                parseCorsOrigins("https://App.Example.com/, https://b.example"),
                "https://app.example.com",
            ),
        ).toBe("https://app.example.com");
    });
});
