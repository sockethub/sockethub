import type { ServiceDescriptor } from "@sockethub/schemas";
import { validateServiceDescriptor } from "@sockethub/schemas";
import type { ManagerOptions, Socket, SocketOptions } from "socket.io-client";

/** The `io()` factory exported by `socket.io-client`. */
export type SocketFactory = (
    uri: string,
    opts?: Partial<ManagerOptions & SocketOptions>,
) => Socket;

export interface DiscoverOptions {
    /** Replacement for the global `fetch`, mainly for tests. */
    fetch?: typeof fetch;
    /** Abort discovery after this many milliseconds. Default 10000. */
    discoveryTimeoutMs?: number;
}

/** Thrown when a server's descriptor cannot be fetched or is not usable. */
export class DiscoveryError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = "DiscoveryError";
    }
}

/**
 * Fetch and validate a Sockethub server's service descriptor from its base
 * URL. Every failure rejects with a `DiscoveryError` that says what went
 * wrong (unreachable, non-JSON, invalid descriptor).
 */
export async function discoverSockethub(
    baseUrl: string,
    options: DiscoverOptions = {},
): Promise<ServiceDescriptor> {
    let url: URL;
    try {
        url = new URL(baseUrl);
    } catch (cause) {
        throw new DiscoveryError(
            `Sockethub discovery needs an absolute base URL, got ${JSON.stringify(baseUrl)}`,
            { cause },
        );
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new DiscoveryError(
            `Sockethub discovery needs an http(s) base URL, got ${JSON.stringify(baseUrl)}`,
        );
    }
    const doFetch = options.fetch ?? globalThis.fetch;
    if (typeof doFetch !== "function") {
        throw new DiscoveryError(
            "Sockethub discovery needs fetch(); pass one in the options",
        );
    }
    const controller = new AbortController();
    const timeoutMs = options.discoveryTimeoutMs ?? 10000;
    // The timer covers the whole exchange: fetch() resolves once headers
    // arrive, and a stalled body would otherwise hang discovery forever.
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const timedOut = () => controller.signal.aborted;

    let descriptor: unknown;
    try {
        let response: Response;
        try {
            response = await doFetch(url.href, {
                headers: { accept: "application/json" },
                signal: controller.signal,
            });
        } catch (cause) {
            const reason = timedOut()
                ? `timed out after ${timeoutMs}ms`
                : cause instanceof Error
                  ? cause.message
                  : String(cause);
            throw new DiscoveryError(
                `Sockethub discovery failed: could not reach ${url.href} (${reason})`,
                { cause },
            );
        }
        if (!response.ok) {
            throw new DiscoveryError(
                `Sockethub discovery failed: ${url.href} answered ${response.status}`,
            );
        }
        try {
            descriptor = await response.json();
        } catch (cause) {
            throw new DiscoveryError(
                timedOut()
                    ? `Sockethub discovery failed: ${url.href} timed out after ${timeoutMs}ms while sending the descriptor`
                    : `Sockethub discovery failed: ${url.href} did not return JSON; is it a Sockethub server?`,
                { cause },
            );
        }
    } finally {
        clearTimeout(timer);
    }
    if (!validateServiceDescriptor(descriptor)) {
        throw new DiscoveryError(
            `Sockethub discovery failed: ${url.href} did not return a valid service descriptor`,
        );
    }
    return descriptor;
}

/**
 * Resolve an advertised endpoint path against the server origin, refusing any
 * result that lands on another origin. The schema already rejects paths that
 * URL resolution would read as protocol-relative; this is the belt to that
 * brace for callers that build URLs from descriptor values.
 */
export function resolveEndpoint(serverOrigin: string, path: string): string {
    const url = new URL(path, serverOrigin);
    if (url.origin !== new URL(serverOrigin).origin) {
        throw new DiscoveryError(
            `Sockethub discovery failed: endpoint path ${JSON.stringify(path)} resolves to ${url.origin}, not ${serverOrigin}`,
        );
    }
    return url.href;
}

export async function resolveSocketFactory(
    explicit?: SocketFactory,
): Promise<SocketFactory> {
    if (explicit) {
        return explicit;
    }
    const globalIo = (globalThis as { io?: unknown }).io;
    if (typeof globalIo === "function") {
        return globalIo as SocketFactory;
    }
    try {
        const mod = (await import("socket.io-client")) as {
            io?: SocketFactory;
        };
        if (typeof mod.io === "function") {
            return mod.io;
        }
    } catch {
        // Fall through to the descriptive error below.
    }
    throw new Error(
        "SockethubClient.connect() needs socket.io-client: install it, load /socket.io.js, or pass `io` in the options",
    );
}
