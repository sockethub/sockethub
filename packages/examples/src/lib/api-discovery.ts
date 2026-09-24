import type { ServiceDescriptor } from "@sockethub/schemas/service-descriptor";
import { writable } from "svelte/store";

export type ApiDiscovery =
    | { state: "available"; descriptor: ServiceDescriptor }
    | { state: "unavailable"; reason: string };

/**
 * The outcome of discovering the server this app was loaded from. Set by
 * `$lib/sockethub` once `SockethubClient.connect()` has fetched the service
 * descriptor from the root URL, or failed to. Undefined while in flight.
 */
export const apiDiscovery = writable<ApiDiscovery | undefined>(undefined);

/** The base URL of the server serving this app, or undefined outside a browser. */
export function serverBaseUrl(
    location: { origin?: string } | undefined = (
        globalThis as { location?: Location }
    ).location,
): string | undefined {
    const origin = location?.origin;
    return origin && origin !== "null" ? origin : undefined;
}

export function describeDiscoveryFailure(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
