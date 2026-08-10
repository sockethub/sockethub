import { describe, expect, it } from "bun:test";
import { validatePlatformSchema } from "@sockethub/schemas";
import Ajv from "ajv";
import { PlatformCardDavSchema } from "./schema.js";

const ajv = new Ajv({ strict: false, allErrors: true });
const validateObject = ajv.compile(
    PlatformCardDavSchema.messages.properties.object,
);

describe("CardDAV schema", () => {
    it("is a valid platform schema", () => {
        expect(validatePlatformSchema(PlatformCardDavSchema)).toBe("");
    });

    it("rejects content-line injection and client preservation data", () => {
        for (const object of [
            {
                type: "person",
                name: "Alice",
                photoUrls: ["https://example.test/a\r\nX-INJECT:1"],
            },
            {
                type: "person",
                name: "Alice",
                birthday: "2000-01-01\nX-INJECT:1",
            },
            {
                type: "person",
                name: "Alice",
                emails: [
                    {
                        value: "alice@example.test",
                        types: ["work;PREF=1"],
                    },
                ],
            },
            {
                type: "person",
                name: "Alice",
                preservedProperties: [{ raw: "X-CLIENT:not-accepted" }],
            },
        ]) {
            expect(validateObject(object)).toBeFalse();
        }
    });
});
