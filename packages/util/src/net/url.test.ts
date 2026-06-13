import { describe, expect, it } from "bun:test";

import { assertHttpUrl, isHttpUrl } from "./url.js";

describe("assertHttpUrl", () => {
    it("accepts http and https URLs", () => {
        expect(assertHttpUrl("http://example.com/x").protocol).toEqual("http:");
        expect(assertHttpUrl("https://example.com").protocol).toEqual("https:");
    });

    it("rejects non-http schemes", () => {
        expect(() => assertHttpUrl("ftp://example.com")).toThrow(
            /unsupported scheme/,
        );
        expect(() => assertHttpUrl("file:///etc/passwd")).toThrow(
            /unsupported scheme/,
        );
    });

    it("rejects malformed URLs", () => {
        expect(() => assertHttpUrl("not a url")).toThrow(/invalid URL/);
    });
});

describe("isHttpUrl", () => {
    it("is true for http(s) URLs and false otherwise", () => {
        expect(isHttpUrl("https://example.com")).toBe(true);
        expect(isHttpUrl("http://example.com")).toBe(true);
        expect(isHttpUrl("ftp://example.com")).toBe(false);
        expect(isHttpUrl("garbage")).toBe(false);
    });
});
