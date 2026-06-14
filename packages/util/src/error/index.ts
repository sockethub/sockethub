/**
 * Normalize an unknown thrown/rejected value into an `Error`. Replaces the
 * repeated `x instanceof Error ? x : new Error(String(x))` idiom so error
 * handling is consistent across packages.
 */
export function toError(value: unknown): Error {
    if (value instanceof Error) {
        return value;
    }
    return new Error(errorMessage(value));
}

/**
 * Extract a human-readable message from an unknown thrown/rejected value.
 * Returns the `Error.message` for `Error` instances, otherwise `String(value)`.
 */
export function errorMessage(value: unknown): string {
    if (value instanceof Error) {
        return value.message;
    }
    return String(value);
}
