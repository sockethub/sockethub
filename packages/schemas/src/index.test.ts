import { describe, expect, it, test } from "bun:test";
import type { ActivityObject, ActivityStream } from "./types";

import testCredentialsData from "./index.test.data.credentials";
import testActivityObjectsData from "./index.test.data.objects";
import testPlatformSchemaData from "./index.test.data.platform";
import testActivityStreamsData from "./index.test.data.streams";
import { ActivityObjectSchema } from "./schemas/activity-object";
import { ActivityStreamSchema } from "./schemas/activity-stream";
import {
    addPlatformContext,
    addPlatformSchema,
    getPlatformSchema,
    validateActivityObject,
    validateActivityStream,
    validateActivityStreamResponse,
    validateCredentials,
    validatePlatformSchema,
} from "./validator";

const permissiveMessageSchema = {
    required: ["type"],
    properties: {
        type: {
            type: "string",
        },
    },
};

addPlatformSchema(permissiveMessageSchema, "irc/messages");
addPlatformSchema(permissiveMessageSchema, "dood/messages");
addPlatformSchema(
    testPlatformSchemaData.credentials,
    "test-platform/credentials",
);
addPlatformContext(
    "irc",
    "https://sockethub.org/ns/context/platform/irc/v1.jsonld",
);
addPlatformContext(
    "dood",
    "https://sockethub.org/ns/context/platform/dood/v1.jsonld",
);
addPlatformContext(
    "test-platform",
    "https://sockethub.org/ns/context/platform/test-platform/v1.jsonld",
);
// A platform with an outbound `responses` schema (only allows type "collection").
addPlatformSchema(
    { required: ["type"], properties: { type: { enum: ["collection"] } } },
    "respplat/responses",
);
addPlatformContext(
    "respplat",
    "https://sockethub.org/ns/context/platform/respplat/v1.jsonld",
);
const RESP_CTX = "https://sockethub.org/ns/context/platform/respplat/v1.jsonld";
const NO_RESP_CTX = "https://sockethub.org/ns/context/platform/dood/v1.jsonld";

describe("schemas/src/index.ts", () => {
    describe("Platform schema validation", () => {
        it("returns an empty error for a valid schema", () => {
            const err = validatePlatformSchema(testPlatformSchemaData);
            expect(err).toEqual("");
        });
        it("returns an error for an invalid schema", () => {
            const err = validatePlatformSchema({ foo: "bar" });
            expect(err).toEqual(
                "platform schema failed to validate:  must have required property 'name'",
            );
        });
        test("includes the unexpected property for additionalProperties errors", () => {
            const err = validatePlatformSchema({
                ...testPlatformSchemaData,
                unexpected: true,
            });
            expect(err).toEqual(
                "platform schema failed to validate:  must NOT have additional properties: unexpected",
            );
        });
    });

    describe("Adding a PlatformSchema", () => {
        it("returns the same schema when fetched", () => {
            const platform_type = "test-platform/credentials";
            const compiledSchema = getPlatformSchema(platform_type);
            expect(compiledSchema.schema).toEqual(
                testPlatformSchemaData.credentials,
            );
        });
    });

    describe("Credentials", () => {
        testCredentialsData.forEach(
            ([name, creds, expectedResult, expectedFailureMessage]) => {
                describe("validateCredential " + name, () => {
                    it(`returns expected result`, () => {
                        const err = validateCredentials(creds as ActivityStream);
                        expect(err).toEqual(expectedFailureMessage);
                        expect(!err).toEqual(expectedResult);
                    });
                });
            },
        );
    });

    describe("ActivityObject", () => {
        it("has expected properties", () => {
            expect(typeof ActivityObjectSchema).toEqual("object");
            expect(ActivityObjectSchema["$id"]).toEqual(
                "https://sockethub.org/schemas/v/activity-object.json",
            );
        });

        testActivityObjectsData.forEach(
            ([name, ao, expectedResult, expectedFailureMessage]) => {
                describe("validateActivityObject " + name, () => {
                    it(`returns expected result`, () => {
                        const err = validateActivityObject(ao as ActivityObject);
                        expect(err).toEqual(expectedFailureMessage);
                        expect(!err).toEqual(expectedResult);
                    });
                });
            },
        );
    });

    describe("ActivityStream", () => {
        it("has expected properties", () => {
            expect(typeof ActivityStreamSchema).toEqual("object");
            expect(ActivityStreamSchema["$id"]).toEqual(
                "https://sockethub.org/schemas/v/activity-stream.json",
            );
        });

        testActivityStreamsData.forEach(
            ([name, as, expectedResult, expectedFailureMessage]) => {
                describe("validateActivityStream " + name, () => {
                    it(`returns expected result`, () => {
                        const err = validateActivityStream(as as ActivityStream);
                        expect(err).toEqual(expectedFailureMessage);
                        expect(!err).toEqual(expectedResult);
                    });
                });
            },
        );
    });

    describe("validateActivityStreamResponse", () => {
        test("is a no-op (passes) when the platform has no responses schema", () => {
            const msg = {
                "@context": [NO_RESP_CTX],
                type: "anything",
                actor: { id: "a@b", type: "person" },
            } as unknown as ActivityStream;
            expect(validateActivityStreamResponse(msg)).toEqual("");
        });

        test("is a no-op when no registered platform context is present", () => {
            const msg = {
                "@context": ["https://example.com/unregistered"],
                type: "collection",
                actor: { id: "a@b", type: "person" },
            } as unknown as ActivityStream;
            expect(validateActivityStreamResponse(msg)).toEqual("");
        });

        test("passes a response matching the platform's responses schema", () => {
            const msg = {
                "@context": [RESP_CTX],
                type: "collection",
                actor: { id: "a@b", type: "feed" },
            } as unknown as ActivityStream;
            expect(validateActivityStreamResponse(msg)).toEqual("");
        });

        test("fails a response that violates the platform's responses schema", () => {
            const msg = {
                "@context": [RESP_CTX],
                type: "page",
                actor: { id: "a@b", type: "feed" },
            } as unknown as ActivityStream;
            expect(validateActivityStreamResponse(msg)).not.toEqual("");
        });
    });
});
