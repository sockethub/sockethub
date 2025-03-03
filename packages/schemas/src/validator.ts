import Ajv, { type Schema } from "ajv";
import addFormats from "ajv-formats";
import additionsFormats2019 from "ajv-formats-draft2019";
import debug from "debug";
import getErrorMessage from "./helpers/error-parser.js";
import { ActivityObjectSchema } from "./schemas/activity-object.js";
import { ActivityStreamSchema } from "./schemas/activity-stream.js";
import { PlatformSchema } from "./schemas/platform.js";
import type { ActivityStream } from "./types.js";

const ajv = new Ajv({ strictTypes: false, allErrors: true });
addFormats(ajv);
additionsFormats2019(ajv);

interface SchemasDict {
    string?: Schema;
}

const log = debug("sockethub:schemas:validator");
const schemaURL = "https://sockethub.org/schemas/v0";
const schemas: SchemasDict = {};

schemas[`${schemaURL}/activity-stream`] = ActivityStreamSchema;
schemas[`${schemaURL}/activity-object`] = ActivityObjectSchema;

for (const uri in schemas) {
    log(`registering schema ${uri}`);
    ajv.addSchema(schemas[uri], uri);
}

function handleValidation(
    schemaRef: string,
    msg: ActivityStream,
    isObject = false,
): string {
    const validator = ajv.getSchema(schemaRef);
    let result: boolean | Promise<unknown>;
    if (isObject) {
        result = validator({ object: msg });
    } else {
        result = validator(msg);
    }
    if (!result) {
        let errorMessage = getErrorMessage(msg, validator.errors);
        if (msg.context) {
            errorMessage = `[${msg.context}] ${errorMessage}`;
        }
        return errorMessage;
    }
    return "";
}

export function validateActivityObject(msg: ActivityStream): string {
    return handleValidation(`${schemaURL}/activity-object`, msg, true);
}

export function validateActivityStream(msg: ActivityStream): string {
    return handleValidation(`${schemaURL}/activity-stream`, msg);
}

export function validateCredentials(msg: ActivityStream): string {
    if (!msg.context) {
        return "credential activity streams must have a context set";
    }
    if (msg.type !== "credentials") {
        return "credential activity streams must have credentials set as type";
    }
    log(
        `validating credentials against ${schemaURL}/context/${msg.context}/credentials`,
    );
    return handleValidation(
        `${schemaURL}/context/${msg.context}/credentials`,
        msg,
    );
}

export function validatePlatformSchema(schema: Schema): string {
    const validate = ajv.compile(PlatformSchema);
    // validate schema property
    const err = validate(schema);
    if (!err) {
        return `platform schema failed to validate: ${validate.errors[0].instancePath} ${validate.errors[0].message}`;
    }
    return "";
}

export function addPlatformSchema(schema: Schema, platform_type: string) {
    log(`registering schema ${schemaURL}/context/${platform_type}`);
    ajv.addSchema(schema, `${schemaURL}/context/${platform_type}`);
}

export function getPlatformSchema(platform_type: string) {
    return ajv.getSchema(`${schemaURL}/context/${platform_type}`);
}
