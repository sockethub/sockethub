import Ajv, { type ValidateFunction } from "ajv";
import {
    isCodegenAvailable,
    warnCodegenUnavailable,
} from "./helpers/codegen.js";
import {
    type ServiceDescriptor,
    ServiceDescriptorSchema,
    type ServiceEndpoints,
} from "./schemas/service-descriptor.js";

let ajv: Ajv | undefined;
let validator: ValidateFunction<ServiceDescriptor> | undefined;

/**
 * Type guard for a server's service descriptor. Validates with Ajv when code
 * generation is available and falls back to a structural check when a Content
 * Security Policy blocks it.
 */
export function validateServiceDescriptor(
    descriptor: unknown,
): descriptor is ServiceDescriptor {
    if (!isCodegenAvailable()) {
        warnCodegenUnavailable();
        return isServiceDescriptorShape(descriptor);
    }
    if (!ajv) {
        ajv = new Ajv({ strictTypes: false, allErrors: true });
    }
    validator ??= ajv.compile<ServiceDescriptor>(ServiceDescriptorSchema);
    return validator(descriptor);
}

/**
 * Structural fallback used when code generation (and therefore Ajv) is
 * unavailable. Mirrors the required members of ServiceDescriptorSchema.
 */
function isServiceDescriptorShape(
    descriptor: unknown,
): descriptor is ServiceDescriptor {
    if (!descriptor || typeof descriptor !== "object") {
        return false;
    }
    const value = descriptor as Record<string, unknown>;
    if (value.name !== "sockethub") {
        return false;
    }
    if (!isApiVersion(value.apiVersion)) {
        return false;
    }
    if (!Array.isArray(value.platforms)) {
        return false;
    }
    for (const platform of value.platforms) {
        if (!platform || typeof platform !== "object") {
            return false;
        }
        const entry = platform as Record<string, unknown>;
        if (typeof entry.id !== "string" || entry.id.length === 0) {
            return false;
        }
        if (!isApiVersion(entry.apiVersion)) {
            return false;
        }
    }
    if (value.endpoints !== undefined) {
        if (!value.endpoints || typeof value.endpoints !== "object") {
            return false;
        }
        const endpoints = value.endpoints as Record<string, unknown>;
        if (!isAbsolutePath(endpoints.socketIO)) {
            return false;
        }
        if (
            endpoints.httpActions !== undefined &&
            !isAbsolutePath(endpoints.httpActions)
        ) {
            return false;
        }
    }
    return true;
}

/** Whether `value` is a Sockethub API version: a non-negative integer. */
function isApiVersion(value: unknown): boolean {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * A server-absolute path: a single leading "/" with no whitespace or backslash
 * (matches ServiceDescriptorSchema's `absolutePath`).
 */
function isAbsolutePath(value: unknown): boolean {
    return typeof value === "string" && /^\/(?![/\\])[^\s\\]*$/.test(value);
}

export { ServiceDescriptorSchema };
export type { ServiceDescriptor, ServiceEndpoints };
