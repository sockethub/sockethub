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
import {
    type RuntimeConfig,
    RuntimeConfigSchema,
    validateRuntimeConfig,
} from "./runtime-config.js";
import { ActivityStreamSchema } from "./schemas/activity-stream.js";
import { PlatformSchema } from "./schemas/platform.js";
import {
    SockethubConfigSchema,
    SockethubConfigSchemaId,
} from "./schemas/sockethub-config.js";
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
    validateSockethubConfig,
} from "./validator.js";

export { normalizeActivityStream } from "./activity-stream-helper.js";

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
    validateRuntimeConfig,
    validateSockethubConfig,
    setValidationErrorOptions,
    PlatformSchema,
    RuntimeConfigSchema,
    ActivityStreamSchema,
    SockethubConfigSchema,
    SockethubConfigSchemaId,
    ObjectTypesList,
    ObjectTypesSchema,
    InternalObjectTypesList,
};

export type { RuntimeConfig };

export * from "./types.js";
