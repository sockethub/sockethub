import {
    addPlatformSchema,
    validateActivityObject,
    validateActivityStream,
    validateCredentials,
    validatePlatformSchema,
} from "./validator.ts";
import { ObjectTypesList } from "./helpers/objects.ts";
import ActivityObjectSchema from "./schemas/activity-object.ts";
import ActivityStreamSchema from "./schemas/activity-stream.ts";
import PlatformSchema from "./schemas/platform.ts";

/**
 * Schema Tools
 */
export default {
    addPlatformSchema,
    validatePlatformSchema,
    validateCredentials,
    validateActivityStream,
    validateActivityObject,
};

export {
    PlatformSchema,
    ActivityObjectSchema,
    ActivityStreamSchema,
    ObjectTypesList,
};

export * from "./types.ts";
