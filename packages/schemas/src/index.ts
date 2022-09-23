import {addPlatformSchema, validateActivityObject, validateActivityStream, validateCredentials,
  validatePlatformSchema} from "./validator";
import { ObjectTypesList } from "./helpers/objects";
import ActivityObjectSchema from "./schemas/activity-object";
import ActivityStreamSchema from "./schemas/activity-stream";
import PlatformSchema from "./schemas/platform";

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
  ObjectTypesList
};

export * from "./types";
