import { describe, expect, it } from "bun:test";
import { parseCorsOrigins } from "./cors.js";

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
