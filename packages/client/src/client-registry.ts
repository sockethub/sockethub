import { addPlatformContext, addPlatformSchema } from "@sockethub/schemas";

// major[.minor[.patch]] with optional prerelease and build metadata.
const LEGACY_VERSION_PATTERN =
    /^v?(\d+)(?:\.\d+){0,2}(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function isPlainObject(value: unknown): value is object {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

/** An API version is a SemVer major: a non-negative safe integer. */
function isApiVersion(value: unknown): value is number {
    return (
        typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    );
}

/**
 * Read an API version off a registry payload or platform entry. Servers that
 * predate API versions published an exact package `version` instead; its
 * SemVer major is the same number, so derive it rather than report nothing.
 */
function resolveApiVersion(source: unknown): number | undefined {
    if (!source || typeof source !== "object") {
        return undefined;
    }
    const { apiVersion, version } = source as {
        apiVersion?: unknown;
        version?: unknown;
    };
    if (isApiVersion(apiVersion)) {
        return apiVersion;
    }
    if (typeof version === "string") {
        const match = LEGACY_VERSION_PATTERN.exec(version.trim());
        const major = match ? Number(match[1]) : undefined;
        if (isApiVersion(major)) {
            return major;
        }
    }
    return undefined;
}

interface PlatformRegistrySchemas {
    credentials?: object;
    messages?: object;
}

/**
 * Server-declared platform metadata used by the client for context generation
 * and runtime validation.
 */
export interface PlatformRegistryEntry {
    id: string;
    // Platform API version (the platform package's SemVer major).
    apiVersion: number;
    contextUrl: string;
    contextVersion: string;
    schemaVersion: string;
    types: Array<string>;
    schemas: PlatformRegistrySchemas;
}

export interface PlatformRegistryPayload {
    // Global Sockethub API version (the server package's SemVer major).
    apiVersion?: number;
    // Server-computed content fingerprint of the registry. The client echoes
    // this on re-request so the server can reply "unchanged" instead of
    // re-sending the full schema set (#1117).
    fingerprint?: string;
    // Set by the server when the echoed fingerprint matches: the registry is
    // identical to what the client already holds, so no platforms are included.
    unchanged?: boolean;
    contexts?: {
        as?: string;
        sockethub?: string;
    };
    platforms?: Array<PlatformRegistryEntry>;
}

export interface ParsedPlatformRegistry {
    apiVersion: number;
    asContextUrl: string;
    sockethubContextUrl: string;
    platforms: Map<string, PlatformRegistryEntry>;
}

/**
 * Validate a server `schemas` payload and rebuild it field by field, so
 * nothing the server sends beyond the bootstrap contract (such as an exact
 * package version) is retained or re-emitted. Returns undefined for a
 * malformed payload; malformed platform entries are skipped.
 */
export function parsePlatformRegistry(
    payload: unknown,
): ParsedPlatformRegistry | undefined {
    if (!payload || typeof payload !== "object") {
        return undefined;
    }
    const registry = payload as PlatformRegistryPayload;
    const asContextUrl = registry.contexts?.as;
    const sockethubContextUrl = registry.contexts?.sockethub;
    if (
        typeof asContextUrl !== "string" ||
        typeof sockethubContextUrl !== "string" ||
        !Array.isArray(registry.platforms)
    ) {
        return undefined;
    }
    // Every server reports an API version (legacy ones via `version`), so
    // a payload without one is malformed rather than merely older.
    const apiVersion = resolveApiVersion(registry);
    if (apiVersion === undefined) {
        return undefined;
    }
    const platforms = new Map<string, PlatformRegistryEntry>();
    for (const platform of registry.platforms) {
        if (
            !platform ||
            typeof platform !== "object" ||
            typeof platform.id !== "string" ||
            typeof platform.contextUrl !== "string" ||
            typeof platform.contextVersion !== "string" ||
            typeof platform.schemaVersion !== "string"
        ) {
            continue;
        }
        const platformApiVersion = resolveApiVersion(platform);
        if (platformApiVersion === undefined) {
            continue;
        }
        const schemas = isPlainObject(platform.schemas) ? platform.schemas : {};
        platforms.set(platform.id, {
            id: platform.id,
            apiVersion: platformApiVersion,
            contextUrl: platform.contextUrl,
            contextVersion: platform.contextVersion,
            schemaVersion: platform.schemaVersion,
            types: Array.isArray(platform.types)
                ? platform.types.filter(
                      (type): type is string => typeof type === "string",
                  )
                : [],
            schemas: {
                credentials: isPlainObject(schemas.credentials)
                    ? schemas.credentials
                    : undefined,
                messages: isPlainObject(schemas.messages)
                    ? schemas.messages
                    : undefined,
            },
        });
    }
    return { apiVersion, asContextUrl, sockethubContextUrl, platforms };
}

/**
 * Register a platform's context and schemas with the @sockethub/schemas
 * validators so local validation uses the same canonical sources as the
 * server.
 */
export function registerPlatformSchemas(platform: PlatformRegistryEntry): void {
    addPlatformContext(platform.id, platform.contextUrl);
    try {
        if (platform.schemas.credentials) {
            addPlatformSchema(
                platform.schemas.credentials,
                `${platform.id}/credentials`,
            );
        }
        if (platform.schemas.messages) {
            addPlatformSchema(
                platform.schemas.messages,
                `${platform.id}/messages`,
            );
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
            `[SockethubClient] Failed to register schemas for platform ${platform.id}: ${message}`,
        );
    }
}
