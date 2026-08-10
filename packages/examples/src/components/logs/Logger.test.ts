import { describe, expect, it } from "vitest";
import { resolveLogDetails } from "./Logger.svelte";

describe("activity log details", () => {
    it("associates a URL-shaped batch response with its originating request", () => {
        const request = { "@context": ["https://example.test"], type: "fetch" };
        const calendar = {
            "@context": ["https://example.test"],
            id: "https://calendar.example.test/team-events/",
            type: "calendar",
        };
        const batchId = `${calendar.id}-2`;
        const logs: Parameters<typeof resolveLogDetails>[0] = {
            "1": [request, {}],
            [batchId]: [{}, calendar],
        };
        const meta = {
            "1": { timestamp: 1, sortKey: 1 },
            [batchId]: { timestamp: 2, sortKey: 2, requestId: "1" },
        };

        expect(resolveLogDetails(logs, meta, batchId)).toEqual({
            sent: request,
            response: calendar,
        });
    });
});
