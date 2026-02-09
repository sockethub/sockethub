/**
 * Tests for tracking in-flight HTTP sessions per platform.
 */
import { describe, expect, it } from "bun:test";
import {
    hasHttpSessions,
    registerHttpSession,
    unregisterHttpSession,
} from "./session-registry.js";

function clearPlatform(platformId: string) {
    while (hasHttpSessions(platformId)) {
        unregisterHttpSession(platformId);
    }
}

describe("http session registry", () => {
    it("increments and decrements session counts", () => {
        const platformId = "platform-1";
        clearPlatform(platformId);

        registerHttpSession(platformId);
        expect(hasHttpSessions(platformId)).toBeTrue();

        registerHttpSession(platformId);
        expect(hasHttpSessions(platformId)).toBeTrue();

        unregisterHttpSession(platformId);
        expect(hasHttpSessions(platformId)).toBeTrue();

        unregisterHttpSession(platformId);
        expect(hasHttpSessions(platformId)).toBeFalse();
    });

    it("handles unregister for unknown platforms", () => {
        const platformId = "platform-2";
        clearPlatform(platformId);

        unregisterHttpSession(platformId);
        expect(hasHttpSessions(platformId)).toBeFalse();
    });
});
