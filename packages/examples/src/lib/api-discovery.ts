import type { ExamplesConfig } from "./examples-config";

/**
 * The public service descriptor served on a bare GET of the HTTP actions
 * path: API versions only, never exact package versions.
 */
export interface ServiceDescriptor {
    name: string;
    apiVersion: number;
    platforms: Array<{ id: string; apiVersion: number }>;
}

export type ApiDiscovery =
    | { state: "available"; endpoint: string; descriptor: ServiceDescriptor }
    | { state: "unavailable"; endpoint?: string; reason: string };

/** The configured HTTP actions endpoint, or undefined when not advertised. */
export function httpActionsEndpoint(
    config: ExamplesConfig,
): string | undefined {
    if (!config.httpActions) {
        return undefined;
    }
    const { protocol, host, port } = config.public;
    return `${protocol}://${host}:${port}${config.httpActions.path}`;
}

/** An API version is a SemVer major: a non-negative safe integer. */
function isApiVersion(value: unknown): value is number {
    return (
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    );
}

function isServiceDescriptor(value: unknown): value is ServiceDescriptor {
    if (!value || typeof value !== "object") {
        return false;
    }
    const descriptor = value as Partial<ServiceDescriptor>;
    return (
        typeof descriptor.name === "string" &&
        isApiVersion(descriptor.apiVersion) &&
        Array.isArray(descriptor.platforms) &&
        descriptor.platforms.every(
            (platform) =>
                platform &&
                typeof platform.id === "string" &&
                isApiVersion(platform.apiVersion),
        )
    );
}

/**
 * Discover API compatibility information over HTTP, without opening a
 * WebSocket connection. Never throws: every failure is an "unavailable" state
 * the home screen can render.
 */
export async function discoverApi(
    config: ExamplesConfig,
): Promise<ApiDiscovery> {
    const endpoint = httpActionsEndpoint(config);
    if (!endpoint) {
        return {
            state: "unavailable",
            reason: "The server did not advertise an HTTP actions endpoint.",
        };
    }
    if (!config.httpActions?.enabled) {
        return {
            state: "unavailable",
            endpoint,
            reason: "HTTP actions are disabled on this server.",
        };
    }
    try {
        const response = await fetch(endpoint, {
            headers: { accept: "application/json" },
        });
        if (!response.ok) {
            return {
                state: "unavailable",
                endpoint,
                reason: `Discovery failed: the endpoint answered ${response.status}.`,
            };
        }
        const descriptor: unknown = await response.json();
        if (!isServiceDescriptor(descriptor)) {
            return {
                state: "unavailable",
                endpoint,
                reason: "Discovery failed: the endpoint did not return a service descriptor.",
            };
        }
        return { state: "available", endpoint, descriptor };
    } catch (error) {
        console.error("API discovery failed", { endpoint, error });
        return {
            state: "unavailable",
            endpoint,
            reason: `Discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
