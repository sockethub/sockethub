import { describe, expect, it } from "bun:test";
import { validatePlatformSchema } from "@sockethub/schemas";
import { PlatformCardDavSchema } from "./schema.js";

describe("CardDAV schema", () => {
    it("is a valid platform schema", () => {
        expect(validatePlatformSchema(PlatformCardDavSchema)).toBe("");
    });
});
