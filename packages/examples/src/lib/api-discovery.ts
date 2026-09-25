import type { ServiceDescriptor } from "@sockethub/schemas/service-descriptor";
import { writable } from "svelte/store";

export type ApiDiscovery =
    | {
          state: "available";
          descriptor: ServiceDescriptor;
          /** Origin the descriptor came from; endpoint paths resolve against it. */
          serverOrigin: string;
      }
    | { state: "unavailable"; reason: string };

/**
 * The outcome of discovering the server this app was loaded from. Set by
 * `$lib/sockethub` once `SockethubClient.connect()` has fetched the service
 * descriptor from the root URL, or failed to. Undefined while in flight.
 */
export const apiDiscovery = writable<ApiDiscovery | undefined>(undefined);

/**
 * The base URL of the Sockethub server to discover. Normally the origin this
 * app was loaded from, since the server serves the app itself; `VITE_SOCKETHUB_URL`
 * overrides it for standalone development on the Vite dev server. Undefined
 * outside a browser.
 */
export function serverBaseUrl(
    location: { origin?: string } | undefined = (
        globalThis as { location?: Location }
    ).location,
    override: string | undefined = import.meta.env?.VITE_SOCKETHUB_URL,
): string | undefined {
    if (typeof override === "string" && override.trim() !== "") {
        return override.trim();
    }
    const origin = location?.origin;
    return origin && origin !== "null" ? origin : undefined;
}

export function describeDiscoveryFailure(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
