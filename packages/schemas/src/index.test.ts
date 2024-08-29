import { ActivityStream } from "./types.ts";
import { assertEquals } from "jsr:@std/assert";

import ActivityStreamSchema from "./schemas/activity-stream.ts";
import ActivityObjectSchema from "./schemas/activity-object.ts";
import {
    addPlatformSchema,
    getPlatformSchema,
    validateActivityObject,
    validateActivityStream,
    validateCredentials,
    validatePlatformSchema,
} from "./validator.ts";
import testCredentialsData from "./index.test.data.credentials.ts";
import testActivityObjectsData from "./index.test.data.objects.ts";
import testActivityStreamsData from "./index.test.data.streams.ts";
import testPlatformSchemaData from "./index.test.data.platform.ts";

Deno.test("Platform schema validation", () => {
    Deno.test("returns an empty error for a valid schema", () => {
        const err = validatePlatformSchema(testPlatformSchemaData);
        assertEquals(err, "");
    });
    Deno.test("returns an error for an invalid schema", () => {
        const err = validatePlatformSchema({ foo: "bar" });
        assertEquals(
            err,
            "platform schema failed to validate:  must have required property 'name'",
        );
    });
});

Deno.test("Adding a PlatformSchema", () => {
    Deno.test("returns the same schema when fetched", () => {
        const platform_type = "test-platform/credentials";
        addPlatformSchema(testPlatformSchemaData.credentials, platform_type);
        const compiledSchema = getPlatformSchema(platform_type);
        assertEquals(
            compiledSchema!.schema,
            testPlatformSchemaData.credentials,
        );
    });
});

Deno.test("Credentials", () => {
    testCredentialsData.forEach(
        ([name, creds, expectedResult, expectedFailureMessage]) => {
            Deno.test("validateCredential " + name, () => {
                Deno.test(`returns expected result`, () => {
                    const err = validateCredentials(creds as ActivityStream);
                    assertEquals(err, expectedFailureMessage);
                    assertEquals(!err, expectedResult);
                });
            });
        },
    );
});

Deno.test("ActivityObject", () => {
    Deno.test("has expected properties", () => {
        assertEquals(typeof ActivityObjectSchema, "object");
        assertEquals(
            ActivityObjectSchema["$id"],
            "https://sockethub.org/schemas/v0/activity-object#",
        );
    });

    testActivityObjectsData.forEach(
        ([name, ao, expectedResult, expectedFailureMessage]) => {
            Deno.test("validateActivityObject " + name, () => {
                Deno.test(`returns expected result`, () => {
                    const err = validateActivityObject(ao as ActivityStream);
                    assertEquals(err, expectedFailureMessage);
                    assertEquals(!err, expectedResult);
                });
            });
        },
    );
});

Deno.test("ActivityStream", () => {
    Deno.test("has expected properties", () => {
        assertEquals(typeof ActivityStreamSchema, "object");
        assertEquals(
            ActivityStreamSchema["$id"],
            "https://sockethub.org/schemas/v0/activity-stream#",
        );
    });

    testActivityStreamsData.forEach(
        ([name, as, expectedResult, expectedFailureMessage]) => {
            Deno.test("validateActivityStream " + name, () => {
                Deno.test(`returns expected result`, () => {
                    const err = validateActivityStream(as as ActivityStream);
                    assertEquals(err, expectedFailureMessage);
                    assertEquals(!err, expectedResult);
                });
            });
        },
    );
});
