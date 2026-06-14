import { describe, expect, it } from "bun:test";

import { errorMessage, toError } from "./index.js";

describe("toError", () => {
    it("returns the same Error instance unchanged", () => {
        const err = new Error("boom");
        expect(toError(err)).toBe(err);
    });

    it("wraps a string", () => {
        const err = toError("nope");
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toEqual("nope");
    });

    it("wraps non-string values via String()", () => {
        expect(toError(42).message).toEqual("42");
        expect(toError(undefined).message).toEqual("undefined");
        expect(toError({ a: 1 }).message).toEqual("[object Object]");
    });

    it("preserves Error subclasses", () => {
        class CustomError extends Error {}
        const err = new CustomError("x");
        expect(toError(err)).toBe(err);
        expect(toError(err)).toBeInstanceOf(CustomError);
    });
});

describe("errorMessage", () => {
    it("returns the message of an Error", () => {
        expect(errorMessage(new Error("hello"))).toEqual("hello");
    });

    it("stringifies non-Error values", () => {
        expect(errorMessage("plain")).toEqual("plain");
        expect(errorMessage(7)).toEqual("7");
        expect(errorMessage(null)).toEqual("null");
    });
});
