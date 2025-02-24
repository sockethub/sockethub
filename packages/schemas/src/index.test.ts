import { describe, expect, it } from "bun:test";
import type { ActivityStream } from "./types";

import testCredentialsData from "./index.test.data.credentials";
import testActivityObjectsData from "./index.test.data.objects";
import testPlatformSchemaData from "./index.test.data.platform";
import testActivityStreamsData from "./index.test.data.streams";
import { ActivityObjectSchema } from "./schemas/activity-object";
import { ActivityStreamSchema } from "./schemas/activity-stream";
import {
    addPlatformSchema,
    getPlatformSchema,
    validateActivityObject,
    validateActivityStream,
    validateCredentials,
    validatePlatformSchema,
} from "./validator";

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
    });

    describe("Adding a PlatformSchema", () => {
        it("returns the same schema when fetched", () => {
            const platform_type = "test-platform/credentials";
            addPlatformSchema(testPlatformSchemaData.credentials, platform_type);
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
                        const err = validateActivityObject(ao as ActivityStream);
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
});
