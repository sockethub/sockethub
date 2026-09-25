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

const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443 };

function nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() !== ""
        ? value.trim()
        : undefined;
}

/**
 * Origin clients reach this server at, built from the `public` settings so it
 * is right behind a reverse proxy. The port is omitted when it is the protocol
 * default.
 */
export function publicOrigin(getConfig: GetConfig = defaultGetConfig): string {
    const protocol = nonEmptyString(getConfig("public:protocol")) ?? "http";
    const host = nonEmptyString(getConfig("public:host")) ?? "localhost";
    const port = Number(getConfig("public:port"));
    const portSuffix =
        Number.isFinite(port) && port > 0 && DEFAULT_PORTS[protocol] !== port
            ? `:${port}`
            : "";
    return `${protocol}://${host}${portSuffix}`;
}

/**
 * The origin and transport path a client hands to `io(origin, { path })`,
 * as shown to humans on the info page.
 */
export function publicSocketEndpoint(getConfig: GetConfig = defaultGetConfig): {
    origin: string;
    path: string;
} {
    return {
        origin: publicOrigin(getConfig),
        path: publicEndpoints(getConfig).socketIO,
    };
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
