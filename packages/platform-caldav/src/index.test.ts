import { describe, expect, it } from "bun:test";
import { CalDavFailure } from "./dav.js";
import { assertCalendarResource } from "./index.js";

describe("CalDAV resource membership", () => {
    const calendar = "https://calendar.example/dav/alice/work/";

    it("accepts a direct child item", () => {
        expect(() =>
            assertCalendarResource(calendar, `${calendar}item.ics`),
        ).not.toThrow();
    });

    it("rejects collection targets and encoded traversal", () => {
        for (const resource of [
            calendar,
            `${calendar}?delete=true`,
            "https://evil.example/dav/alice/work/item.ics",
            "https://calendar.example/dav/alice/work-other/item.ics",
            `${calendar}item.ics#fragment`,
            `${calendar}..%2f..%2ffiles/item`,
            `${calendar}%2e%2e%2f%2e%2e%2ffiles/item`,
            `${calendar}%252e%252e%252ffiles/item`,
        ]) {
            expect(() => assertCalendarResource(calendar, resource)).toThrow(
                new CalDavFailure("caldav:invalid-resource"),
            );
        }
    });
});
