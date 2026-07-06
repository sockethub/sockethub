import { createLogger } from "@sockethub/logger";

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
