/**
 * Public API compatibility and connection information.
 *
 * Both public transports publish from here — the Socket.IO `schemas`
 * bootstrap, the HTTP actions service descriptor, and the root info page —
 * so they cannot disagree on API versions or on where to connect. Exact
 * package versions are deliberately absent: clients check compatibility
 * against SemVer majors, and publishing release numbers would make
 * deployments easy to fingerprint.
 */
import {
    AS2_BASE_CONTEXT_URL,
    type ServiceDescriptor,
    type ServiceEndpoints,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "@sockethub/schemas";
import type { PlatformMap } from "./bootstrap/load-platforms.js";
import config from "./config.js";
import { SOCKETHUB_API_VERSION } from "./version.js";

export type GetConfig = (key: string) => unknown;

const defaultGetConfig: GetConfig = (key) => config.get(key);

function nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() !== ""
        ? value.trim()
        : undefined;
}

/** The test and demo platform; it leads every platform listing. */
const DUMMY_PLATFORM_ID = "dummy";

/**
 * Loaded platforms in display order: `dummy` first, because it is the odd
 * one out that should not be enabled in production, then the rest
 * alphabetically by id. Every public listing uses this order.
 */
export function sortedPlatforms(platforms: PlatformMap) {
    return Array.from(platforms.values()).sort((a, b) => {
        if (a.id === DUMMY_PLATFORM_ID || b.id === DUMMY_PLATFORM_ID) {
            return a.id === b.id ? 0 : a.id === DUMMY_PLATFORM_ID ? -1 : 1;
        }
        return a.id.localeCompare(b.id);
    });
}

/**
 * The connection endpoints advertised to clients, as server-absolute paths
 * on whatever origin the client reached us at. `httpActions` is present only
 * when that transport is enabled, so a client can tell "off" from "unknown"
 * without probing.
 */
export function publicEndpoints(
    getConfig: GetConfig = defaultGetConfig,
): ServiceEndpoints {
    const endpoints: ServiceEndpoints = {
        socketIO: nonEmptyString(getConfig("sockethub:path")) ?? "/",
    };
    const httpActionsPath = nonEmptyString(getConfig("httpActions:path"));
    if (Boolean(getConfig("httpActions:enabled")) && httpActionsPath) {
        endpoints.httpActions = httpActionsPath;
    }
    return endpoints;
}

/**
 * The machine-readable descriptor served on a bare GET of the HTTP actions
 * path and on `GET /` with `Accept: application/json`. Its shape is
 * published as `ServiceDescriptorSchema`.
 */
export function buildServiceDescriptor(
    platforms: PlatformMap,
    getConfig: GetConfig = defaultGetConfig,
): ServiceDescriptor {
    return {
        name: "sockethub",
        apiVersion: SOCKETHUB_API_VERSION,
        endpoints: publicEndpoints(getConfig),
        platforms: sortedPlatforms(platforms).map((platform) => ({
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
        platforms: sortedPlatforms(platforms).map((platform) => ({
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
