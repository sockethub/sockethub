import { describe, expect, it } from "vitest";
import { platformId } from "./runtime-config";

describe("runtime config", () => {
    it("derives example IDs from scoped platform package names", () => {
        expect(platformId("@sockethub/platform-feeds")).toBe("feeds");
        expect(platformId("platform-irc")).toBe("irc");
    });
});
