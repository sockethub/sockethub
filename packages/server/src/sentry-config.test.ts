import { afterEach, describe, expect, it } from "bun:test";

import {
    mergeForwardedSentryConfig,
    resolveSentryConfig,
    SENTRY_CONFIG_ENV,
    type SentryConfig,
    serializeSentryConfig,
} from "./sentry-config.js";

const BASE: SentryConfig = {
    dsn: "",
    environment: "production",
    release: "",
    enableLogs: false,
    logLevels: ["warn", "error"],
    enableMetrics: true,
    tracesSampleRate: 0.1,
    profileSessionSampleRate: 0,
    sendDefaultPii: false,
};

const FORWARDED: SentryConfig = {
    ...BASE,
    dsn: "https://key@o1.ingest.sentry.io/1",
    environment: "staging",
    release: "sockethub@9.9.9",
    enableLogs: true,
    logLevels: ["debug", "info", "warn", "error"],
    tracesSampleRate: 1,
};

describe("serializeSentryConfig", () => {
    it("returns undefined when no dsn is configured", () => {
        expect(serializeSentryConfig(BASE)).toBeUndefined();
    });

    it("serializes the whole block when a dsn is configured", () => {
        const serialized = serializeSentryConfig(FORWARDED);
        expect(serialized).toBeDefined();
        expect(JSON.parse(serialized as string)).toEqual(FORWARDED);
    });
});

describe("mergeForwardedSentryConfig", () => {
    it("keeps the local block when nothing was forwarded", () => {
        expect(mergeForwardedSentryConfig(BASE, undefined)).toEqual(BASE);
        expect(mergeForwardedSentryConfig(BASE, "")).toEqual(BASE);
    });

    it("lets every forwarded key win, not just the dsn", () => {
        const merged = mergeForwardedSentryConfig(
            BASE,
            JSON.stringify(FORWARDED),
        );
        expect(merged).toEqual(FORWARDED);
        // A worker sampling at the base rate while the server samples at 1.0
        // would silently under-report; the forwarded rate must win.
        expect(merged.tracesSampleRate).toBe(1);
        expect(merged.enableLogs).toBe(true);
    });

    it("keeps local values for keys the parent did not send", () => {
        const merged = mergeForwardedSentryConfig(
            BASE,
            JSON.stringify({ dsn: FORWARDED.dsn }),
        );
        expect(merged.dsn).toBe(FORWARDED.dsn);
        expect(merged.environment).toBe(BASE.environment);
        expect(merged.logLevels).toEqual(BASE.logLevels);
    });

    it("throws on malformed JSON", () => {
        expect(() => mergeForwardedSentryConfig(BASE, "{not json")).toThrow();
    });

    it("throws when the payload is not a JSON object", () => {
        expect(() => mergeForwardedSentryConfig(BASE, '"a string"')).toThrow(
            SENTRY_CONFIG_ENV,
        );
        expect(() => mergeForwardedSentryConfig(BASE, "[1,2]")).toThrow(
            SENTRY_CONFIG_ENV,
        );
        expect(() => mergeForwardedSentryConfig(BASE, "null")).toThrow(
            SENTRY_CONFIG_ENV,
        );
    });
});

describe("resolveSentryConfig", () => {
    afterEach(() => {
        delete process.env[SENTRY_CONFIG_ENV];
    });

    it("uses this process's own configuration when nothing was forwarded", () => {
        delete process.env[SENTRY_CONFIG_ENV];
        // No config file is loaded under test, so this is the schema default:
        // Sentry off.
        expect(resolveSentryConfig().dsn).toBe("");
    });

    it("applies the parent's forwarded settings", () => {
        process.env[SENTRY_CONFIG_ENV] = JSON.stringify(FORWARDED);
        const resolved = resolveSentryConfig();
        expect(resolved.dsn).toBe(FORWARDED.dsn);
        expect(resolved.environment).toBe("staging");
        expect(resolved.tracesSampleRate).toBe(1);
    });

    it("falls back to local settings on malformed forwarded input", () => {
        process.env[SENTRY_CONFIG_ENV] = "{not json";
        // Logged and ignored rather than crashing the worker at startup.
        expect(resolveSentryConfig().dsn).toBe("");
    });
});
