/**
 * Parse `url` and require an `http:`/`https:` scheme, returning the parsed
 * `URL`. Throws a descriptive `Error` on a malformed URL or unsupported scheme.
 * Used to gate outbound fetches of client-supplied URLs.
 */
export function assertHttpUrl(url: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error(`invalid URL: ${url}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`unsupported scheme ${parsed.protocol} for ${url}`);
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
