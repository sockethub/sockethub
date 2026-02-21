import Ajv, { type Schema } from "ajv";
import addFormats from "ajv-formats";
import additionsFormats2019 from "ajv-formats-draft2019";
import {
    ERROR_PLATFORM_CONTEXT_URL,
    ERROR_PLATFORM_ID,
    getCredentialsSchemaIdByContextUrl,
    getPlatformIdByContextUrl,
    getSchemaIdByContextUrl,
    INTERNAL_PLATFORM_CONTEXT_URL,
    INTERNAL_PLATFORM_ID,
    registerPlatformContext,
    resolvePlatformContextUrl,
} from "./context.js";
import getErrorMessage, {
    type ValidationErrorOptions,
} from "./helpers/error-parser.js";
import { ActivityObjectSchema } from "./schemas/activity-object.js";
import { ActivityStreamSchema } from "./schemas/activity-stream.js";
import { PlatformSchema } from "./schemas/platform.js";
import type { ActivityStream } from "./types.js";

const ajv = new Ajv({ strictTypes: false, allErrors: true });
addFormats(ajv as unknown as Parameters<typeof addFormats>[0]);
additionsFormats2019(ajv as unknown as Ajv);

type SchemasDict = Record<string, Schema>;

const schemaURL = "https://sockethub.org/schemas/v0";
const schemas: SchemasDict = {};
let validationErrorOptions: ValidationErrorOptions = {};
let systemContextsRegistered = false;

schemas[`${schemaURL}/activity-stream`] = ActivityStreamSchema;
schemas[`${schemaURL}/activity-object`] = ActivityObjectSchema;

for (const uri in schemas) {
    ajv.addSchema(schemas[uri], uri);
}

function registerSystemContext(platformId: string, contextUrl: string): void {
    registerPlatformContext(
        platformId,
        contextUrl,
        `${schemaURL}/context/${platformId}/messages`,
        `${schemaURL}/context/${platformId}/credentials`,
    );

    const messageSchemaRef = `${schemaURL}/context/${platformId}/messages`;
    if (!ajv.getSchema(messageSchemaRef)) {
        ajv.addSchema({}, messageSchemaRef);
    }

    const credentialsSchemaRef = `${schemaURL}/context/${platformId}/credentials`;
    if (!ajv.getSchema(credentialsSchemaRef)) {
        ajv.addSchema({}, credentialsSchemaRef);
    }
}

export function registerSystemPlatformContexts(): void {
    if (systemContextsRegistered) {
        return;
    }
    registerSystemContext(ERROR_PLATFORM_ID, ERROR_PLATFORM_CONTEXT_URL);
    registerSystemContext(INTERNAL_PLATFORM_ID, INTERNAL_PLATFORM_CONTEXT_URL);
    systemContextsRegistered = true;
}

registerSystemPlatformContexts();

function handleValidation(
    schemaRef: string,
    msg: ActivityStream,
    isObject = false,
): string {
    const validator = ajv.getSchema(schemaRef);
    if (!validator) {
        return `schema ${schemaRef} not found`;
    }
    let result: boolean | Promise<unknown>;
    if (isObject) {
        result = validator({ object: msg });
    } else {
        result = validator(msg);
    }
    if (!result) {
        let errorMessage = getErrorMessage(
            msg,
            validator.errors,
            validationErrorOptions,
        );
        const platformContextUrl = resolvePlatformContextUrl(msg);
        if (platformContextUrl) {
            const platformId = getPlatformIdByContextUrl(platformContextUrl);
            if (platformId) {
                errorMessage = `[${platformId}] ${errorMessage}`;
            }
        }
        return errorMessage;
    }
    return "";
}

export function setValidationErrorOptions(
    options: ValidationErrorOptions,
): void {
    validationErrorOptions = { ...validationErrorOptions, ...options };
}

export function validateActivityObject(msg: ActivityStream): string {
    return handleValidation(`${schemaURL}/activity-object`, msg, true);
}

export function validateActivityStream(msg: ActivityStream): string {
    const streamValidationError = handleValidation(
        `${schemaURL}/activity-stream`,
        msg,
    );
    if (streamValidationError) {
        return streamValidationError;
    }
    const platformContextUrl = resolvePlatformContextUrl(msg);
    if (!platformContextUrl) {
        return "activity streams must have exactly one registered platform context URL in @context";
    }
    const schemaId = getSchemaIdByContextUrl(platformContextUrl);
    if (!schemaId) {
        return `platform context URL ${platformContextUrl} does not have a registered message schema`;
    }
    return handleValidation(schemaId, msg);
}

export function validateCredentials(msg: ActivityStream): string {
    if (!Array.isArray(msg["@context"])) {
        return "credential activity streams must have an @context set";
    }
    if (msg.type !== "credentials") {
        return "credential activity streams must have credentials set as type";
    }
    const streamValidationError = handleValidation(
        `${schemaURL}/activity-stream`,
        msg,
    );
    if (streamValidationError) {
        return streamValidationError;
    }
    const platformContextUrl = resolvePlatformContextUrl(msg);
    if (!platformContextUrl) {
        return "credential activity streams must have exactly one registered platform context URL in @context";
    }
    const credentialsSchemaId =
        getCredentialsSchemaIdByContextUrl(platformContextUrl);
    if (!credentialsSchemaId) {
        return `platform context URL ${platformContextUrl} does not have a registered credentials schema`;
    }
    return handleValidation(credentialsSchemaId, msg);
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
    const schemaRef = `${schemaURL}/context/${platform_type}`;
    ajv.addSchema(schema, schemaRef);
    const parts = platform_type.split("/");
    if (parts.length === 2) {
        const [platformId] = parts;
        const platformContextUrl = `https://sockethub.org/ns/context/platform/${platformId}/v1.jsonld`;
        registerPlatformContext(
            platformId,
            platformContextUrl,
            `${schemaURL}/context/${platformId}/messages`,
            `${schemaURL}/context/${platformId}/credentials`,
        );
    }
}

export function getPlatformSchema(platform_type: string) {
    return ajv.getSchema(`${schemaURL}/context/${platform_type}`);
}

export function addPlatformContext(
    platformId: string,
    platformContextUrl: string,
) {
    registerPlatformContext(
        platformId,
        platformContextUrl,
        `${schemaURL}/context/${platformId}/messages`,
        `${schemaURL}/context/${platformId}/credentials`,
    );
}

export function resolvePlatformId(msg: ActivityStream): string | null {
    const platformContextUrl = resolvePlatformContextUrl(msg);
    if (!platformContextUrl) {
        return null;
    }
    return getPlatformIdByContextUrl(platformContextUrl) || null;
}
