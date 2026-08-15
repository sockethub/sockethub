import Ajv, { type ValidateFunction } from "ajv";
import {
    type ExamplesConfig,
    ExamplesConfigSchema,
} from "./schemas/examples-config.js";

const ajv = new Ajv({ strictTypes: false, allErrors: true });
let validator: ValidateFunction<ExamplesConfig> | undefined;

export function validateExamplesConfig(
    config: unknown,
): config is ExamplesConfig {
    validator ??= ajv.compile<ExamplesConfig>(ExamplesConfigSchema);
    return validator(config);
}

export { ExamplesConfigSchema };
export type { ExamplesConfig };
