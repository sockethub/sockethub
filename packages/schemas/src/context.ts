import type { ActivityStream, JsonLdContext } from "./types.js";

export const AS2_BASE_CONTEXT_URL = "https://www.w3.org/ns/activitystreams";
export const SOCKETHUB_BASE_CONTEXT_URL =
    "https://sockethub.org/ns/context/v1.jsonld";
export const ERROR_PLATFORM_ID = "error";
export const ERROR_PLATFORM_CONTEXT_URL =
    "https://sockethub.org/ns/context/platform/error/v1.jsonld";
export const INTERNAL_PLATFORM_ID = "sockethub:internal";
export const INTERNAL_PLATFORM_CONTEXT_URL =
    "https://sockethub.org/ns/context/platform/sockethub:internal/v1.jsonld";

const platformContextToPlatformId = new Map<string, string>();
const platformContextToSchemaId = new Map<string, string>();
const platformContextToCredentialsSchemaId = new Map<string, string>();

export function buildCanonicalContext(
    platformContextUrl: string,
): JsonLdContext {
    return [
        AS2_BASE_CONTEXT_URL,
        SOCKETHUB_BASE_CONTEXT_URL,
        platformContextUrl,
    ];
}

function normalizeContextArray(value: unknown): Array<string> {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}

export function getContextArray(msg: ActivityStream): Array<string> {
    return normalizeContextArray(msg["@context"]);
}

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

export function getPlatformIdByContextUrl(
    platformContextUrl: string,
): string | undefined {
    return platformContextToPlatformId.get(platformContextUrl);
}

export function getSchemaIdByContextUrl(
    platformContextUrl: string,
): string | undefined {
    return platformContextToSchemaId.get(platformContextUrl);
}

export function getCredentialsSchemaIdByContextUrl(
    platformContextUrl: string,
): string | undefined {
    return platformContextToCredentialsSchemaId.get(platformContextUrl);
}
