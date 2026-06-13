import { describe, expect, it } from "bun:test";

import { assertHttpUrl, isHttpUrl, redactUrl } from "./url.js";

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

    it("redacts credentials from error messages", () => {
        try {
            assertHttpUrl("ftp://user:secret@example.com");
            throw new Error("should have thrown");
        } catch (err) {
            const msg = (err as Error).message;
            expect(msg).not.toMatch(/secret/);
            expect(msg).not.toMatch(/user:/);
            expect(msg).toMatch(/example\.com/);
        }
    });
});

describe("redactUrl", () => {
    it("strips userinfo from a URL", () => {
        expect(redactUrl("https://user:pass@example.com/x")).toEqual(
            "https://example.com/x",
        );
    });

    it("leaves credential-free URLs unchanged", () => {
        expect(redactUrl("https://example.com/x")).toEqual(
            "https://example.com/x",
        );
    });

    it("best-effort redacts userinfo in unparseable input", () => {
        expect(redactUrl("//user:pass@host/x")).toMatch(/\/\/\*\*\*@host/);
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
