/**
 * Ajv compiles JSON schemas with `new Function`. Environments that forbid eval
 * — a browser-extension page under a Manifest V3 Content Security Policy, or
 * some sandboxes — block that call, which would otherwise make importing this
 * package throw before a single schema is used. Detect availability once so
 * validation can be skipped there.
 *
 * Skipping client-side validation is safe: the Sockethub server validates every
 * inbound message against the same schemas.
 */

let available: boolean | undefined;
let warned = false;

export function isCodegenAvailable(): boolean {
    if (available === undefined) {
        try {
            new Function("return true");
            available = true;
        } catch {
            available = false;
        }
    }
    return available;
}

/** Emit a one-time notice that schema validation is disabled. */
export function warnCodegenUnavailable(): void {
    if (warned) {
        return;
    }
    warned = true;
    console.warn(
        "[@sockethub/schemas] Schema validation is disabled: this environment's Content Security Policy blocks `new Function`, which Ajv needs to compile schemas. The Sockethub server still validates every message.",
    );
}

/**
 * Force the codegen-availability result. Test-only seam for exercising the
 * CSP fallback; pass `undefined` to restore detection.
 */
export function setCodegenAvailableForTesting(value?: boolean): void {
    available = value;
}
