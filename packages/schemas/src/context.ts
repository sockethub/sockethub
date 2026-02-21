import type { ActivityStream, JsonLdContext } from "./types.js";

/**
 * Canonical AS2 base vocabulary URL.
 */
export const AS2_BASE_CONTEXT_URL = "https://www.w3.org/ns/activitystreams";

/**
 * Sockethub base vocabulary URL for shared platform terms.
 */
export const SOCKETHUB_BASE_CONTEXT_URL =
    "https://sockethub.org/ns/context/v1.jsonld";

/**
 * Built-in pseudo-platform used for server-side error payloads.
 */
export const ERROR_PLATFORM_ID = "error";
export const ERROR_PLATFORM_CONTEXT_URL =
    "https://sockethub.org/ns/context/platform/error/v1.jsonld";

/**
 * Built-in pseudo-platform used for internal control messages.
 */
export const INTERNAL_PLATFORM_ID = "sockethub:internal";
export const INTERNAL_PLATFORM_CONTEXT_URL =
    "https://sockethub.org/ns/context/platform/sockethub:internal/v1.jsonld";

const platformContextToPlatformId = new Map<string, string>();
const platformContextToSchemaId = new Map<string, string>();
const platformContextToCredentialsSchemaId = new Map<string, string>();

/**
 * Build the canonical Sockethub @context array for a platform context URL.
 */
export function buildCanonicalContext(
    platformContextUrl: string,
): JsonLdContext {
    return [
        AS2_BASE_CONTEXT_URL,
        SOCKETHUB_BASE_CONTEXT_URL,
        platformContextUrl,
    ];
}

/**
 * Normalize unknown @context input into a string-only array.
 */
function normalizeContextArray(value: unknown): Array<string> {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Get a normalized @context array from an activity stream.
 */
export function getContextArray(msg: ActivityStream): Array<string> {
    return normalizeContextArray(msg["@context"]);
}

/**
 * Register a platform context URL and its schema IDs for runtime resolution.
 */
export function registerPlatformContext(
    platformId: string,
    platformContextUrl: string,
    schemaId: string,
    credentialsSchemaId: string,
) {
    platformContextToPlatformId.set(platformContextUrl, platformId);
    platformContextToSchemaId.set(platformContextUrl, schemaId);
    platformContextToCredentialsSchemaId.set(
        platformContextUrl,
        credentialsSchemaId,
    );
}

/**
 * Resolve the single registered platform context URL from a message.
 * Returns null when there are zero or multiple registered platform contexts.
 */
export function resolvePlatformContextUrl(msg: ActivityStream): string | null {
    const contexts = getContextArray(msg);
    const matches = contexts.filter((contextUrl) =>
        platformContextToPlatformId.has(contextUrl),
    );
    if (matches.length !== 1) {
        return null;
    }
    return matches[0];
}

/**
 * Resolve a platform ID from a platform context URL.
 */
export function getPlatformIdByContextUrl(
    platformContextUrl: string,
): string | undefined {
    return platformContextToPlatformId.get(platformContextUrl);
}

/**
 * Resolve a message schema ID from a platform context URL.
 */
export function getSchemaIdByContextUrl(
    platformContextUrl: string,
): string | undefined {
    return platformContextToSchemaId.get(platformContextUrl);
}

/**
 * Resolve a credentials schema ID from a platform context URL.
 */
export function getCredentialsSchemaIdByContextUrl(
    platformContextUrl: string,
): string | undefined {
    return platformContextToCredentialsSchemaId.get(platformContextUrl);
}
