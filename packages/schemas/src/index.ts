import { ObjectTypesList } from "./helpers/objects.js";
import { ActivityObjectSchema } from "./schemas/activity-object.js";
import { ActivityStreamSchema } from "./schemas/activity-stream.js";
import { PlatformSchema } from "./schemas/platform.js";
import { SockethubConfigSchema } from "./schemas/sockethub-config.js";
import {
    addPlatformSchema,
    getPlatformSchema,
    validateActivityObject,
    validateActivityStream,
    validateCredentials,
    validatePlatformSchema,
} from "./validator.js";

export {
    addPlatformSchema,
    getPlatformSchema,
    validatePlatformSchema,
    validateCredentials,
    validateActivityStream,
    validateActivityObject,
    PlatformSchema,
    ActivityObjectSchema,
    ActivityStreamSchema,
    SockethubConfigSchema,
    ObjectTypesList,
};

export * from "./types.js";
