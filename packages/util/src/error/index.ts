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

/**
 * Marker for errors that represent expected operational outcomes rather than
 * server defects — e.g. a user-supplied URL timing out, a remote site
 * refusing a scrape, or a page with no extractable metadata. The platform
 * job handler skips Sentry error capture for marked errors (counting them as
 * a metric instead), keeping production error tracking focused on real bugs.
 *
 * The mark is a `Symbol.for` property so it survives duplicated copies of
 * this module in a dependency tree. It is process-local: it does not survive
 * serialization across IPC or the job queue.
 */
const EXPECTED_ERROR = Symbol.for("sockethub.expectedError");

type MarkableError = Error & { [EXPECTED_ERROR]?: boolean };

/** Mark an error as an expected operational failure. Returns the same instance. */
export function markExpectedError<T extends Error>(err: T): T {
    (err as MarkableError)[EXPECTED_ERROR] = true;
    return err;
}

/** Whether `value` is an Error marked via {@link markExpectedError}. */
export function isExpectedError(value: unknown): boolean {
    return (
        value instanceof Error &&
        (value as MarkableError)[EXPECTED_ERROR] === true
    );
}
