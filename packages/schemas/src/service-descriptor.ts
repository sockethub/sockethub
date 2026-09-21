import Ajv, { type ValidateFunction } from "ajv";
import {
    type ServiceDescriptor,
    ServiceDescriptorSchema,
} from "./schemas/service-descriptor.js";

const ajv = new Ajv({ strictTypes: false, allErrors: true });
let validator: ValidateFunction<ServiceDescriptor> | undefined;

export function validateServiceDescriptor(
    descriptor: unknown,
): descriptor is ServiceDescriptor {
    validator ??= ajv.compile<ServiceDescriptor>(ServiceDescriptorSchema);
    return validator(descriptor);
}

export { ServiceDescriptorSchema };
export type { ServiceDescriptor };
