import debug from "debug";
import Ajv, { ErrorObject, Schema } from "ajv";
import addFormats from "ajv-formats";
import additionsFormats2019 from "ajv-formats-draft2019";
import getErrorMessage from "./helpers/error-parser.ts";
import { ActivityStream } from "./types.ts";
import PlatformSchema from "./schemas/platform.ts";
import ActivityStreamsSchema from "./schemas/activity-stream.ts";
import ActivityObjectSchema from "./schemas/activity-object.ts";
import { ValidateFunction } from "npm:ajv@8.12.0";

const ajv = new Ajv.default({ strictTypes: false, allErrors: true });
addFormats.default(ajv);
additionsFormats2019(ajv);

interface SchemasDict {
    string?: Schema;
}

const log = debug("sockethub:schemas:validator");
const schemaURL = "https://sockethub.org/schemas/v0";
const schemas: SchemasDict = {};

schemas[`${schemaURL}/activity-stream` as keyof SchemasDict] = ActivityStreamsSchema;
schemas[`${schemaURL}/activity-object` as keyof SchemasDict] = ActivityObjectSchema;

for (const uri in schemas) {
    log(`registering schema ${uri}`);
    ajv.addSchema(schemas[uri as keyof SchemasDict] as Schema, uri);
}

function handleValidation(
    schemaRef: string,
    msg: ActivityStream,
    isObject = false,
): string {
    const validator = ajv.getSchema(schemaRef) as ValidateFunction;
    let result: boolean | Promise<unknown>;
    if (isObject) {
        result = validator({ object: msg });
    } else {
        result = validator(msg);
    }
    if (!result) {
        let errorMessage = getErrorMessage(msg, validator.errors as ErrorObject[]);
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
        const errObj: ErrorObject = validate.errors![0];
        return (
            `platform schema failed to validate: ` +
            `${errObj.instancePath} ${errObj.message}`
        );
    } else {
        return "";
    }
}

export function addPlatformSchema(schema: Schema, platform_type: string) {
    log(`registering schema ${schemaURL}/context/${platform_type}`);
    ajv.addSchema(schema, `${schemaURL}/context/${platform_type}`);
}

export function getPlatformSchema(platform_type: string) {
    return ajv.getSchema(`${schemaURL}/context/${platform_type}`);
}
