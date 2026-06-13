/**
 * Strip any `user:password@` userinfo from a URL so it is safe to include in
 * error messages, logs, or telemetry. Best-effort for unparseable input.
 */
export function redactUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.username || parsed.password) {
            parsed.username = "";
            parsed.password = "";
            return parsed.toString();
        }
        return url;
    } catch {
        return url.replace(/\/\/[^/@\s]*@/, "//***@");
    }
}

/**
 * Parse `url` and require an `http:`/`https:` scheme, returning the parsed
 * `URL`. Throws a descriptive `Error` (with credentials redacted) on a
 * malformed URL or unsupported scheme. Used to gate outbound fetches of
 * client-supplied URLs.
 */
export function assertHttpUrl(url: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`invalid URL: ${redactUrl(url)}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(
            `unsupported scheme ${parsed.protocol} for ${redactUrl(url)}`,
        );
    }
    return parsed;
}

/** Returns true if `url` parses and uses an `http:`/`https:` scheme. */
export function isHttpUrl(url: string): boolean {
    try {
        assertHttpUrl(url);
        return true;
    } catch {
        return false;
    }
}
