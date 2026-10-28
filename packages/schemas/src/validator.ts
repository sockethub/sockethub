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
import {
    isCodegenAvailable,
    warnCodegenUnavailable,
} from "./helpers/codegen.js";
import getErrorMessage, {
    type ValidationErrorOptions,
} from "./helpers/error-parser.js";
import { ActorTypesList, TargetTypesList } from "./helpers/objects.js";
import { ActivityStreamSchema } from "./schemas/activity-stream.js";
import { PlatformSchema } from "./schemas/platform.js";
import { SockethubConfigSchema } from "./schemas/sockethub-config.js";
import type { ActivityStream } from "./types.js";

type SchemasDict = Record<string, Schema>;

const schemaURL = "https://sockethub.org/schemas/v0";
const schemas: SchemasDict = {};
let validationErrorOptions: ValidationErrorOptions = {};
let systemContextsRegistered = false;

schemas[`${schemaURL}/activity-stream`] = ActivityStreamSchema;

let ajv: Ajv | undefined;

/**
 * Lazily create the shared Ajv instance and register every known schema.
 * Constructing Ajv and adding schemas compiles them with `new Function`, which
 * a Content Security Policy that forbids eval (browser extensions) blocks.
 * Returns `undefined` when code generation is unavailable, so callers skip
 * validation; the Sockethub server remains the authority.
 */
function getAjv(): Ajv | undefined {
    if (!isCodegenAvailable()) {
        warnCodegenUnavailable();
        return undefined;
    }
    if (!ajv) {
        const instance = new Ajv({ strictTypes: false, allErrors: true });
        addFormats(instance as unknown as Parameters<typeof addFormats>[0]);
        additionsFormats2019(instance as unknown as Ajv);
        for (const uri in schemas) {
            instance.addSchema(schemas[uri], uri);
        }
        ajv = instance;
    }
    return ajv;
}

/**
 * Register a built-in (system) platform's context and, when Ajv is available,
 * empty message and credentials schemas for it. Also used as a no-op Ajv step
 * under a code-generation-blocking CSP.
 */
function registerSystemContext(platformId: string, contextUrl: string): void {
    registerPlatformContext(
        platformId,
        contextUrl,
        `${schemaURL}/context/${platformId}/messages`,
        `${schemaURL}/context/${platformId}/credentials`,
    );

    const instance = getAjv();
    if (!instance) {
        return;
    }

    const messageSchemaRef = `${schemaURL}/context/${platformId}/messages`;
    if (!instance.getSchema(messageSchemaRef)) {
        instance.addSchema({}, messageSchemaRef);
    }

    const credentialsSchemaRef = `${schemaURL}/context/${platformId}/credentials`;
    if (!instance.getSchema(credentialsSchemaRef)) {
        instance.addSchema({}, credentialsSchemaRef);
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

/**
 * Validate `msg` against the schema registered at `schemaRef`. Returns an empty
 * string when valid, otherwise a human-readable error; returns "" if Ajv is
 * unavailable or the schema is not registered.
 */
function handleValidation(schemaRef: string, msg: ActivityStream): string {
    const instance = getAjv();
    if (!instance) {
        return "";
    }
    const validator = instance.getSchema(schemaRef);
    if (!validator) {
        return `schema ${schemaRef} not found`;
    }
    const result = validator(msg);
    if (!result) {
        let errorMessage = getErrorMessage(
            msg,
            validator.errors,
            validationErrorOptions,
        );
        if (Array.isArray((msg as ActivityStream)["@context"])) {
            const platformContextUrl = resolvePlatformContextUrl(
                msg as ActivityStream,
            );
            if (platformContextUrl) {
                const platformId =
                    getPlatformIdByContextUrl(platformContextUrl);
                if (platformId) {
                    errorMessage = `[${platformId}] ${errorMessage}`;
                }
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

let sockethubConfigValidator: ReturnType<Ajv["compile"]> | undefined;

/**
 * Validate a (fully-materialized) Sockethub server config object against the
 * canonical config schema. Returns "" when valid, otherwise a human-readable
 * error string. Used by the server at startup so a mis-typed or unknown config
 * value — including inside a platform's `packageConfig` entry — fails loudly
 * rather than reaching a platform wrong-typed.
 */
export function validateSockethubConfig(config: unknown): string {
    const instance = getAjv();
    if (!instance) {
        return "";
    }
    if (!sockethubConfigValidator) {
        sockethubConfigValidator = instance.compile(SockethubConfigSchema);
    }
    if (sockethubConfigValidator(config)) {
        return "";
    }
    return instance.errorsText(sockethubConfigValidator.errors, {
        dataVar: "config",
    });
}

/**
 * Validate an inbound activity stream against the shared envelope and its
 * registered platform message schema. Returns "" when valid; skipped (also "")
 * when code generation is unavailable.
 */
export function validateActivityStream(msg: ActivityStream): string {
    if (!isCodegenAvailable()) {
        warnCodegenUnavailable();
        return "";
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
        return "activity streams must have exactly one registered platform context URL in @context";
    }
    const schemaId = getSchemaIdByContextUrl(platformContextUrl);
    if (!schemaId) {
        return `platform context URL ${platformContextUrl} does not have a registered message schema`;
    }
    return handleValidation(schemaId, msg);
}

/**
 * Validate an outbound platform response against that platform's `responses`
 * schema. Returns "" when the platform has no responses schema registered (yet),
 * so outbound validation can be adopted platform-by-platform.
 */
export function validateActivityStreamResponse(msg: ActivityStream): string {
    if (!isCodegenAvailable()) {
        warnCodegenUnavailable();
        return "";
    }
    const platformContextUrl = resolvePlatformContextUrl(msg);
    if (!platformContextUrl) {
        return "";
    }
    const platformId = getPlatformIdByContextUrl(platformContextUrl);
    if (!platformId) {
        return "";
    }
    const responsesSchemaId = `${schemaURL}/context/${platformId}/responses`;
    const instance = getAjv();
    if (!instance || !instance.getSchema(responsesSchemaId)) {
        return "";
    }
    return handleValidation(responsesSchemaId, msg);
}

/**
 * Validate a credentials activity stream against the shared envelope and its
 * registered platform credentials schema. Returns "" when valid; skipped (also
 * "") when code generation is unavailable.
 */
export function validateCredentials(msg: ActivityStream): string {
    if (!isCodegenAvailable()) {
        warnCodegenUnavailable();
        return "";
    }
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

/**
 * Validate a platform schema: its structural shape via Ajv (when available)
 * and that its actor/target types are registered in the shared ActivityStreams
 * envelope. Returns "" when valid, otherwise an error string.
 */
export function validatePlatformSchema(schema: Schema): string {
    const instance = getAjv();
    if (instance) {
        const validate = instance.compile(PlatformSchema);
        // validate schema property
        const err = validate(schema);
        if (!err) {
            const validationError = validate.errors?.[0];
            let message = `${validationError?.instancePath ?? ""} ${validationError?.message ?? "is invalid"}`;
            if (validationError?.keyword === "additionalProperties") {
                message += `: ${validationError.params.additionalProperty}`;
            }
            return `platform schema failed to validate: ${message}`;
        }
    }
    const platform = schema as Record<string, unknown>;
    const messages = platform.messages as Record<string, unknown> | undefined;
    const properties = messages?.properties as
        | Record<string, unknown>
        | undefined;
    const declaredTypes = (root: unknown): Set<string> => {
        const result = new Set<string>();
        const visit = (value: unknown): void => {
            if (!value || typeof value !== "object" || Array.isArray(value))
                return;
            const node = value as Record<string, unknown>;
            if (typeof node.const === "string") result.add(node.const);
            if (Array.isArray(node.enum)) {
                for (const item of node.enum) {
                    if (typeof item === "string") result.add(item);
                }
            }
            const nodeProperties = node.properties as
                | Record<string, unknown>
                | undefined;
            visit(nodeProperties?.type);
            for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
                const branches = node[keyword];
                if (Array.isArray(branches)) branches.forEach(visit);
            }
        };
        visit(root);
        return result;
    };
    for (const [property, allowed] of [
        ["actor", ActorTypesList],
        ["target", TargetTypesList],
    ] as const) {
        const unsupported = [...declaredTypes(properties?.[property])].filter(
            (type) => !allowed.includes(type),
        );
        if (unsupported.length > 0) {
            return `platform schema ${property} types are not registered in the shared ActivityStreams envelope: ${unsupported.join(", ")}`;
        }
    }
    return "";
}

/**
 * Register a platform's message or credentials schema with the validators, so
 * local validation uses the same canonical sources as the server. No-op when
 * code generation is unavailable.
 */
export function addPlatformSchema(schema: Schema, platform_type: string) {
    const instance = getAjv();
    if (!instance) {
        return;
    }
    const schemaRef = `${schemaURL}/context/${platform_type}`;
    if (!instance.getSchema(schemaRef)) {
        instance.addSchema(schema, schemaRef);
    }
}

/**
 * Look up a registered platform schema validator, or `undefined` when no such
 * schema is registered or code generation is unavailable.
 */
export function getPlatformSchema(platform_type: string) {
    return getAjv()?.getSchema(`${schemaURL}/context/${platform_type}`);
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
    return getPlatformIdByContextUrl(platformContextUrl) ?? null;
}
