import {
    type ServiceDescriptor,
    validateServiceDescriptor,
} from "@sockethub/schemas/service-descriptor";
import type { ExamplesConfig } from "./examples-config";

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
        if (!validateServiceDescriptor(descriptor)) {
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
