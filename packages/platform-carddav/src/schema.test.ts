import { describe, expect, it } from "bun:test";
import {
    addPlatformContext,
    addPlatformSchema,
    buildCanonicalContext,
    validateActivityStream,
    validatePlatformSchema,
} from "@sockethub/schemas";
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

    it("accepts complete activities through the shared and platform schemas", () => {
        addPlatformContext("carddav", PlatformCardDavSchema.contextUrl);
        addPlatformSchema(PlatformCardDavSchema.messages, "carddav/messages");
        const actor = { id: "carddav:alice", type: "person" };
        const target = {
            id: "https://contacts.example/addressbooks/alice/personal/",
            type: "addressBook",
        };
        const contact = { type: "person", name: "Alice" };
        const activities = [
            { type: "fetch", actor },
            {
                type: "query",
                actor,
                target,
                object: { type: "contactQuery", text: "Alice" },
            },
            { type: "create", actor, target, object: contact },
            {
                type: "update",
                actor,
                target,
                object: {
                    ...contact,
                    id: `${target.id}alice.vcf`,
                    uid: "alice",
                    etag: '"one"',
                },
            },
            {
                type: "delete",
                actor,
                target,
                object: {
                    type: "person",
                    id: `${target.id}alice.vcf`,
                    etag: '"one"',
                },
            },
        ];

        for (const activity of activities) {
            expect(
                validateActivityStream({
                    "@context": buildCanonicalContext("carddav"),
                    ...activity,
                }),
            ).toBe("");
        }
    });
});
