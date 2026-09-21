/**
 * Public API compatibility information.
 *
 * Both public transports publish from here — the Socket.IO `schemas`
 * bootstrap and the HTTP actions service descriptor — so they cannot disagree
 * on API versions. Exact package versions are deliberately absent: clients
 * check compatibility against SemVer majors, and publishing release numbers
 * would make deployments easy to fingerprint.
 */
import {
    AS2_BASE_CONTEXT_URL,
    type ServiceDescriptor,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "@sockethub/schemas";
import type { PlatformMap } from "./bootstrap/load-platforms.js";
import { SOCKETHUB_API_VERSION } from "./version.js";

/**
 * The machine-readable descriptor served on a bare GET of the HTTP actions
 * path. Its shape is published as `ServiceDescriptorSchema`.
 */
export function buildServiceDescriptor(
    platforms: PlatformMap,
): ServiceDescriptor {
    return {
        name: "sockethub",
        apiVersion: SOCKETHUB_API_VERSION,
        platforms: Array.from(platforms.values()).map((platform) => ({
            id: platform.id,
            apiVersion: platform.apiVersion,
        })),
    };
}

/**
 * The platform registry payload sent to Socket.IO clients.
 * This is the canonical source for base contexts + platform context/schema metadata.
 */
export function buildPlatformRegistryPayload(platforms: PlatformMap) {
    return {
        apiVersion: SOCKETHUB_API_VERSION,
        contexts: {
            as: AS2_BASE_CONTEXT_URL,
            sockethub: SOCKETHUB_BASE_CONTEXT_URL,
        },
        platforms: Array.from(platforms.values()).map((platform) => ({
            id: platform.id,
            apiVersion: platform.apiVersion,
            contextUrl: platform.contextUrl,
            contextVersion: platform.contextVersion,
            schemaVersion: platform.schemaVersion,
            types: platform.types,
            schemas: {
                credentials: platform.schemas.credentials || {},
                messages: platform.schemas.messages || {},
            },
        })),
    };
}
