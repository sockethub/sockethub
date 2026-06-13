import type { Agent } from "undici";
import { createGuardedDispatcher } from "./dispatcher.js";
import { assertHttpUrl, redactUrl } from "./url.js";

export interface SafeFetchOptions {
    /**
     * Skip the private/loopback destination checks. Dev/test escape hatch only.
     * Ignored when an explicit `dispatcher` is provided.
     */
    allowPrivateAddresses?: boolean;
    /** Response body cap in bytes. Ignored when `dispatcher` is provided. */
    maxResponseBytes?: number;
    /** Per-request timeout (applied via AbortSignal.timeout). */
    timeoutMs?: number;
    /**
     * A pre-built guarded dispatcher to reuse (for connection pooling across
     * requests). When omitted, a guarded dispatcher is created per call from
     * `allowPrivateAddresses`/`maxResponseBytes`.
     */
    dispatcher?: Agent;
    /** Extra request headers. */
    headers?: Record<string, string>;
}

/**
 * SSRF- and resource-guarded outbound fetch for client-supplied URLs:
 *
 * - rejects non-`http(s)` schemes and malformed URLs before connecting;
 * - routes the request through a guarded undici dispatcher that refuses
 *   private/loopback/metadata destinations (every redirect hop) and caps the
 *   response body;
 * - applies an optional timeout and throws on a non-2xx response.
 *
 * Returns the `Response` (read the body with `.text()`/`.json()`/etc.).
 */
export async function safeFetch(
    url: string,
    options: SafeFetchOptions = {},
): Promise<Response> {
    assertHttpUrl(url);

    const dispatcher =
        options.dispatcher ??
        createGuardedDispatcher({
            allowPrivateAddresses: options.allowPrivateAddresses,
            maxResponseBytes: options.maxResponseBytes,
        });

    const init: RequestInit & { dispatcher?: unknown } = { dispatcher };
    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
        init.signal = AbortSignal.timeout(options.timeoutMs);
    }
    if (options.headers) {
        init.headers = options.headers;
    }

    const res = await fetch(url, init as RequestInit);
    if (!res.ok) {
        // Drain the unused body so the keep-alive connection is returned to the
        // pool instead of leaking until GC.
        await res.body?.cancel().catch(() => {});
        // HTTP/2 has no reason phrases, so statusText may be empty.
        const statusText = res.statusText ? ` ${res.statusText}` : "";
        throw new Error(
            `request failed: ${res.status}${statusText} for ${redactUrl(url)}`,
        );
    }
    return res;
}
