import { createLogger } from "@sockethub/logger";
import type { RequestHandler } from "express";

const log = createLogger("server:cors");

/**
 * Parse the `sockethub:cors:origin` config value into either `"*"` (any
 * origin) or a normalized origin allow-list. Both the socket.io listener and
 * the HTTP actions routes resolve their CORS policy through this single
 * parser so the two transports can never drift apart.
 *
 * Browsers serialize the `Origin` request header as a lowercase
 * `scheme://host[:port]` with default ports omitted and no trailing slash or
 * path. Configured entries are normalized to that same serialization before
 * matching, so values like `https://App.example.com/` still match what the
 * browser actually sends. Entries that cannot yield a usable origin are
 * dropped with a warning rather than left in the list where they would
 * silently never match.
 *
 * A restrictive config that yields no valid origins returns an empty list
 * (blocking all cross-origin requests) instead of falling back to `"*"`:
 * when an operator attempted to restrict origins, failing closed is the only
 * safe interpretation.
 */
export function parseCorsOrigins(configured: unknown): "*" | Array<string> {
    const raw = typeof configured === "string" ? configured.trim() : "";
    if (raw === "" || raw === "*") {
        return "*";
    }
    const origins: Array<string> = [];
    for (const entry of raw.split(",")) {
        const trimmed = entry.trim();
        if (trimmed.length === 0) {
            continue;
        }
        if (trimmed === "*") {
            log.warn(
                "cors origin list contains '*'; allowing any origin and " +
                    "ignoring the other entries",
            );
            return "*";
        }
        let origin: string;
        try {
            origin = new URL(trimmed).origin;
        } catch {
            log.warn(
                `ignoring cors origin entry that is not a valid URL: "${trimmed}"` +
                    " (origins must include a scheme, e.g. https://app.example.com)",
            );
            continue;
        }
        // Non-special schemes (file:, data:, ...) serialize to the opaque
        // origin "null", which no browser request can legitimately match.
        if (origin === "null") {
            log.warn(
                `ignoring cors origin entry with no usable origin: "${trimmed}"`,
            );
            continue;
        }
        if (origin !== trimmed) {
            log.warn(`normalized cors origin "${trimmed}" to "${origin}"`);
        }
        if (!origins.includes(origin)) {
            origins.push(origin);
        }
    }
    if (origins.length === 0) {
        log.error(
            "cors origin config contained no valid origins; all " +
                "cross-origin requests will be blocked",
        );
    }
    return origins;
}

/**
 * Resolve the `Access-Control-Allow-Origin` value for a request against an
 * allow-list already parsed by `parseCorsOrigins`. Returns `"*"` when any
 * origin is allowed, the request's own origin when it is in the allow-list,
 * or `undefined` when it is not allowed (the browser then blocks the
 * response). The request origin is run through the same URL normalization as
 * the configured entries, so matching never depends on the client sending
 * the canonical serialization.
 */
export function resolveAllowedOrigin(
    allowedOrigins: "*" | Array<string>,
    requestOrigin: string | undefined,
): string | undefined {
    if (allowedOrigins === "*") {
        return "*";
    }
    if (!requestOrigin) {
        return undefined;
    }
    let normalized: string;
    try {
        normalized = new URL(requestOrigin).origin;
    } catch {
        return undefined;
    }
    return allowedOrigins.includes(normalized) ? requestOrigin : undefined;
}

const CORS_ALLOWED_METHODS = "GET, POST, OPTIONS";
const CORS_ALLOWED_HEADERS =
    "Content-Type, X-Request-Id, X-Sockethub-Request-Id";
const CORS_EXPOSED_HEADERS = "X-Request-Id, X-Idempotent-Replay";

/**
 * CORS middleware for the public HTTP routes (HTTP actions and the root
 * service descriptor), honoring the same `sockethub:cors:origin` config that
 * governs socket.io. Emits the allow headers and answers preflight `OPTIONS`
 * requests so browser clients on a configured origin can call the endpoint.
 */
export function createCorsMiddleware(
    getConfig: (key: string) => unknown,
): RequestHandler {
    // Parse the allow-list (and log any config warnings) once at route
    // registration rather than on every request.
    const allowedOrigins = parseCorsOrigins(
        getConfig("sockethub:cors:origin") as string | undefined,
    );
    return (req, res, next) => {
        const allowOrigin = resolveAllowedOrigin(
            allowedOrigins,
            req.headers.origin,
        );
        if (allowOrigin) {
            res.setHeader("Access-Control-Allow-Origin", allowOrigin);
            if (allowOrigin !== "*") {
                // Response varies by origin, so it must not be cached and served
                // to a different origin.
                res.setHeader("Vary", "Origin");
            }
        }
        res.setHeader("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
        res.setHeader("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
        res.setHeader("Access-Control-Expose-Headers", CORS_EXPOSED_HEADERS);
        res.setHeader("Access-Control-Max-Age", "600");
        if (req.method === "OPTIONS") {
            res.status(204).end();
            return;
        }
        next();
    };
}
