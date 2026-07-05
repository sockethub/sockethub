import { describe, expect, it, test } from "bun:test";
import type { ActivityStream } from "./types";

import testCredentialsData from "./index.test.data.credentials";
import testPlatformSchemaData from "./index.test.data.platform";
import testActivityStreamsData from "./index.test.data.streams";
import { ActivityStreamSchema } from "./schemas/activity-stream";
import {
    addPlatformContext,
    addPlatformSchema,
    getPlatformSchema,
    validateActivityStream,
    validateActivityStreamResponse,
    validateCredentials,
    validatePlatformSchema,
} from "./validator";

// The base envelope no longer enumerates a global object vocabulary; platforms
// own inbound object validation via their `messages` schema. This object-aware
// test schema exercises that mechanism (object `oneOf` referencing object-type
// definitions) for the data-driven stream fixtures, with its object vocabulary
// declared locally (as a real platform would).
const objectAwareMessageSchema = {
    required: ["type"],
    properties: {
        type: { type: "string" },
        object: {
            type: "object",
            oneOf: [
                "credentials",
                "message",
                "feed",
                "website",
                "attendance",
                "presence",
                "topic",
                "address",
                "relationship",
            ].map((type) => ({ $ref: `#/definitions/type/${type}` })),
        },
    },
    definitions: {
        type: {
            credentials: {
                required: ["type"],
                additionalProperties: true,
                properties: { type: { enum: ["credentials"] } },
            },
            message: {
                required: ["type", "content"],
                additionalProperties: true,
                properties: {
                    type: { enum: ["message"] },
                    id: { type: "string" },
                    name: { type: "string" },
                    content: { type: "string" },
                },
            },
            feed: {
                required: ["id", "type"],
                additionalProperties: true,
                properties: {
                    type: { enum: ["feed"] },
                    id: { type: "string", format: "iri" },
                    name: { type: "string" },
                    description: { type: "string" },
                    author: { type: "string" },
                    favicon: { type: "string" },
                },
            },
            website: {
                required: ["id", "type"],
                additionalProperties: true,
                properties: {
                    id: { type: "string", format: "iri" },
                    type: { enum: ["website"] },
                    name: { type: "string" },
                },
            },
            attendance: {
                required: ["type"],
                additionalProperties: false,
                properties: {
                    type: { enum: ["attendance"] },
                    members: { type: "array", items: { type: "string" } },
                },
            },
            presence: {
                required: ["type"],
                additionalProperties: false,
                properties: {
                    type: { enum: ["presence"] },
                    presence: {
                        enum: ["away", "chat", "dnd", "xa", "offline", "online"],
                    },
                    role: {
                        enum: ["owner", "member", "participant", "admin"],
                    },
                    content: { type: "string" },
                },
            },
            topic: {
                required: ["type"],
                additionalProperties: false,
                properties: {
                    type: { enum: ["topic"] },
                    content: { type: "string" },
                },
            },
            address: {
                required: ["type"],
                additionalProperties: false,
                properties: { type: { enum: ["address"] } },
            },
            relationship: {
                required: ["type", "relationship"],
                additionalProperties: false,
                properties: {
                    type: { enum: ["relationship"] },
                    relationship: { enum: ["role"] },
                    subject: {
                        type: "object",
                        oneOf: [{ $ref: "#/definitions/type/presence" }],
                    },
                    object: { type: "object" },
                },
            },
        },
    },
};

// `dood` is a fake test platform (not a real package), used to exercise
// per-platform object validation without colliding with real platforms'
// registrations in the shared schema singleton during the combined test run.
addPlatformSchema(objectAwareMessageSchema, "dood/messages");
addPlatformSchema(
    testPlatformSchemaData.credentials,
    "test-platform/credentials",
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
