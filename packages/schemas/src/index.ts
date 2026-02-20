import {
    AS2_BASE_CONTEXT_URL,
    buildCanonicalContext,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "./context.js";
import { InternalObjectTypesList, ObjectTypesList } from "./helpers/objects.js";
import { ActivityObjectSchema } from "./schemas/activity-object.js";
import { ActivityStreamSchema } from "./schemas/activity-stream.js";
import { PlatformSchema } from "./schemas/platform.js";
import { SockethubConfigSchema } from "./schemas/sockethub-config.js";
import {
    addPlatformContext,
    addPlatformSchema,
    getPlatformSchema,
    resolvePlatformId,
    setValidationErrorOptions,
    validateActivityObject,
    validateActivityStream,
    validateCredentials,
    validatePlatformSchema,
} from "./validator.js";

export {
    AS2_BASE_CONTEXT_URL,
    SOCKETHUB_BASE_CONTEXT_URL,
    buildCanonicalContext,
    addPlatformContext,
    addPlatformSchema,
    getPlatformSchema,
    resolvePlatformId,
    validatePlatformSchema,
    validateCredentials,
    validateActivityStream,
    validateActivityObject,
    setValidationErrorOptions,
    PlatformSchema,
    ActivityObjectSchema,
    ActivityStreamSchema,
    SockethubConfigSchema,
    ObjectTypesList,
    InternalObjectTypesList,
};

export * from "./types.js";
