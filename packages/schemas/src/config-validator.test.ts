import { describe, expect, it } from "bun:test";

import { validateSockethubConfig } from "./validator.js";

describe("validateSockethubConfig", () => {
    const base = { platforms: ["@sockethub/platform-feeds"] };

    it("accepts a minimal valid config", () => {
        expect(validateSockethubConfig(base)).toEqual("");
    });

    it("accepts a well-typed packageConfig entry", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-feeds": { connectTimeoutMs: 5000 },
                },
            }),
        ).toEqual("");
    });

    it("accepts the feeds allowPrivateAddresses boolean", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-feeds": {
                        allowPrivateAddresses: true,
                    },
                },
            }),
        ).toEqual("");
    });

    it("rejects a non-boolean allowPrivateAddresses", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-feeds": {
                        allowPrivateAddresses: "true",
                    },
                },
            }),
        ).not.toEqual("");
    });

    it("rejects an unknown top-level key", () => {
        expect(validateSockethubConfig({ ...base, nope: 1 })).not.toEqual("");
    });

    it("rejects a mis-typed packageConfig value", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-feeds": { connectTimeoutMs: "5000" },
                },
            }),
        ).not.toEqual("");
    });

    it("rejects an unknown key within a packageConfig entry", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-feeds": { bogus: true },
                },
            }),
        ).not.toEqual("");
    });
});
