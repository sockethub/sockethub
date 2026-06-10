import {
    AS2_BASE_CONTEXT_URL,
    buildCanonicalContext,
    ERROR_PLATFORM_CONTEXT_URL,
    ERROR_PLATFORM_ID,
    INTERNAL_PLATFORM_CONTEXT_URL,
    INTERNAL_PLATFORM_ID,
    PLATFORM_CONTEXT_PREFIX,
    platformIdFromContext,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "./context.js";
import {
    InternalObjectTypesList,
    ObjectTypesList,
    ObjectTypesSchema,
} from "./helpers/objects.js";
import { ActivityStreamSchema } from "./schemas/activity-stream.js";
import { PlatformSchema } from "./schemas/platform.js";
import { SockethubConfigSchema } from "./schemas/sockethub-config.js";
import {
    addPlatformContext,
    addPlatformSchema,
    getPlatformSchema,
    registerSystemPlatformContexts,
    resolvePlatformId,
    setValidationErrorOptions,
    validateActivityStream,
    validateActivityStreamResponse,
    validateCredentials,
    validatePlatformSchema,
} from "./validator.js";

export {
    type ActivityStreamProcessor,
    type ActivityStreamProcessorOptions,
    createActivityStreamProcessor,
    extractObjectPropertyExtensionsFromMessageSchema,
    type JsonSchemaLike,
    normalizeActivityStream,
} from "./activity-stream-helper.js";

export {
    AS2_BASE_CONTEXT_URL,
    SOCKETHUB_BASE_CONTEXT_URL,
    PLATFORM_CONTEXT_PREFIX,
    ERROR_PLATFORM_ID,
    ERROR_PLATFORM_CONTEXT_URL,
    INTERNAL_PLATFORM_ID,
    INTERNAL_PLATFORM_CONTEXT_URL,
    buildCanonicalContext,
    platformIdFromContext,
    addPlatformContext,
    addPlatformSchema,
    getPlatformSchema,
    resolvePlatformId,
    registerSystemPlatformContexts,
    validatePlatformSchema,
    validateCredentials,
    validateActivityStream,
    validateActivityStreamResponse,
    setValidationErrorOptions,
    PlatformSchema,
    ActivityStreamSchema,
    SockethubConfigSchema,
    ObjectTypesList,
    ObjectTypesSchema,
    InternalObjectTypesList,
};

export * from "./types.js";
