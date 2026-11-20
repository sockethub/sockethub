import { describe, expect, it } from "bun:test";

import { validateSockethubConfig } from "./validator.js";

describe("validateSockethubConfig", () => {
    const base = { platforms: ["@sockethub/platform-feeds"] };

    it("requires non-negative integer instance quotas", () => {
        for (const field of ["maxInstancesPerSession", "maxInstancesPerIp", "maxStartsPerIpPerMinute"]) {
            for (const value of [0, 1, 20]) {
                expect(validateSockethubConfig({ ...base, limits: { [field]: value } })).toBe("");
            }
            for (const value of [-1, 1.5]) {
                expect(validateSockethubConfig({ ...base, limits: { [field]: value } })).not.toBe("");
            }
        }
    });

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

    it("accepts the metadata allowPrivateAddresses boolean", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-metadata": {
                        allowPrivateAddresses: true,
                    },
                },
            }),
        ).toEqual("");
    });

    it("accepts the xmpp allowPrivateAddresses boolean", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-xmpp": {
                        allowPrivateAddresses: true,
                    },
                },
            }),
        ).toEqual("");
    });

    it("accepts the metadata user agents documented in its README", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-metadata": {
                        userAgent: "MyDeployment/1.0 (+https://my.example)",
                        compatUserAgent: "Mozilla/5.0 (compatible; TelegramBot/1.0)",
                    },
                },
            }),
        ).toEqual("");
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: { "@sockethub/platform-metadata": { userAgent: 1 } },
            }),
        ).not.toEqual("");
    });

    it("accepts media platform limits and rejects out-of-range ones", () => {
        const withImage = (entry: unknown) =>
            validateSockethubConfig({
                ...base,
                packageConfig: { "@sockethub/platform-media": entry },
            });
        expect(
            withImage({
                maxBytes: 2097152,
                timeoutMs: 5000,
                concurrency: 2,
                types: ["png", "jpeg"],
                userAgent: "MyDeployment/1.0",
            }),
        ).toEqual("");
        expect(withImage({ maxBytes: 26214401 })).not.toEqual("");
        expect(withImage({ types: ["bmp"] })).not.toEqual("");
        expect(withImage({ enabled: false })).not.toEqual("");
    });

    it("accepts a Web Push key pair and rejects a malformed one", () => {
        const withWebPush = (entry: unknown) =>
            validateSockethubConfig({
                ...base,
                packageConfig: { "@sockethub/platform-webpush": entry },
            });
        const vapid = {
            publicKey: "B".repeat(87),
            privateKey: "a".repeat(43),
            subject: "mailto:ops@example.org",
        };
        expect(
            withWebPush({
                vapid,
                allowedHosts: ["*.push.apple.com", "fcm.googleapis.com"],
                timeoutMs: 10000,
            }),
        ).toEqual("");
        expect(withWebPush({})).toEqual("");
        // A key that is not a P-256 pair, or a contact Apple would refuse.
        expect(withWebPush({ vapid: { ...vapid, publicKey: "short" } })).not.toEqual("");
        expect(withWebPush({ vapid: { ...vapid, subject: "ops@example.org" } })).not.toEqual("");
        expect(withWebPush({ vapid: { publicKey: vapid.publicKey } })).not.toEqual("");
        expect(withWebPush({ vapidKey: "x" })).not.toEqual("");
    });

    it("requires a scheduled delivery secret of at least 32 characters", () => {
        const withSchedule = (scheduledDelivery: unknown) =>
            validateSockethubConfig({ ...base, scheduledDelivery });
        expect(withSchedule({ secret: "" })).toEqual("");
        expect(
            withSchedule({
                secret: "s".repeat(32),
                maxMessagesPerSubscription: 30,
                maxSubscriptions: 500,
                maxDaysAhead: 14,
                maxSchedulesPerMinute: 0,
            }),
        ).toEqual("");
        expect(withSchedule({ secret: "too-short" })).not.toEqual("");
        expect(withSchedule({ maxMessagesPerSubscription: 0 })).not.toEqual("");
        expect(withSchedule({ maxMessagesPerSubscription: 1001 })).not.toEqual("");
    });

    it("rejects an unknown key in the metadata packageConfig entry", () => {
        expect(
            validateSockethubConfig({
                ...base,
                packageConfig: {
                    "@sockethub/platform-metadata": { bogus: true },
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
