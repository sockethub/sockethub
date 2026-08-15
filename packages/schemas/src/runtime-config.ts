import Ajv, { type ValidateFunction } from "ajv";
import {
    type RuntimeConfig,
    RuntimeConfigSchema,
} from "./schemas/runtime-config.js";

const ajv = new Ajv({ strictTypes: false, allErrors: true });
let validator: ValidateFunction<RuntimeConfig> | undefined;

export function validateRuntimeConfig(
    config: unknown,
): config is RuntimeConfig {
    validator ??= ajv.compile<RuntimeConfig>(RuntimeConfigSchema);
    return validator(config);
}

export { RuntimeConfigSchema };
export type { RuntimeConfig };
