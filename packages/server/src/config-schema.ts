import { SockethubConfigSchema } from "@sockethub/schemas";
import convict from "convict";

/**
 * The convict configuration schema, derived from the canonical JSON schema in
 * `@sockethub/schemas` so defaults, types and enums have a single source of
 * truth. This module only layers on the server-specific concerns the JSON
 * schema cannot express: environment variable and command-line argument
 * bindings, and convict format refinements ("nat", "port").
 */

type JsonSchemaNode = {
    type?: string | Array<string>;
    enum?: Array<unknown>;
    default?: unknown;
    description?: string;
    properties?: Record<string, JsonSchemaNode>;
};

type OverlayEntry = {
    /** Convict format override (e.g. "nat", "port", "*"). */
    format?: unknown;
    /** Environment variable bound to this key. */
    env?: string;
    /**
     * Treat an empty-string value of `env` as unset so it falls back to the
     * config file / default, preserving the historical `process.env.X || ...`
     * behavior (convict would otherwise apply the empty string as an
     * override). Deliberately NOT set for SOCKETHUB_CORS_ORIGIN, where an
     * empty string must stay applied so CORS fails closed.
     */
    emptyEnvIsUnset?: boolean;
    /** Command-line argument bound to this key. */
    arg?: string;
    /**
     * Treat this object node as a single convict leaf (validated as a whole
     * by the JSON schema pass) instead of recursing into its properties.
     */
    leaf?: boolean;
    /** Default for leaves the JSON schema declares no default for. */
    default?: unknown;
};

const OVERLAY: Record<string, OverlayEntry> = {
    $schema: { default: "" },
    examples: { arg: "examples" },
    info: { arg: "info" },
    "logging.level": { env: "LOG_LEVEL", emptyEnvIsUnset: true },
    "logging.fileLevel": { env: "LOG_FILE_LEVEL", emptyEnvIsUnset: true },
    "logging.file": { env: "LOG_FILE", emptyEnvIsUnset: true },
    packageConfig: { leaf: true, format: Object },
    "public.port": { format: "port" },
    "rateLimiter.windowMs": { format: "nat" },
    "rateLimiter.maxRequests": { format: "nat" },
    "rateLimiter.blockDurationMs": { format: "nat" },
    "rateLimiter.maxConnectionsPerIp": { format: "nat" },
    "limits.maxPlatformInstances": { format: "nat" },
    "credentials.ttlMs": {
        format: "nat",
        env: "SOCKETHUB_CREDENTIALS_TTL_MS",
        emptyEnvIsUnset: true,
    },
    "redis.url": {
        env: "REDIS_URL",
        emptyEnvIsUnset: true,
        arg: "redis.url",
    },
    "redis.connectTimeout": { format: "nat" },
    "redis.disconnectTimeout": { format: "nat" },
    "redis.maxRetriesPerRequest": { format: "*" },
    "sentry.dsn": { arg: "sentry.dsn" },
    "sockethub.port": {
        format: "port",
        env: "PORT",
        emptyEnvIsUnset: true,
        arg: "port",
    },
    "sockethub.host": { env: "HOST", emptyEnvIsUnset: true, arg: "host" },
    "sockethub.cors.origin": {
        env: "SOCKETHUB_CORS_ORIGIN",
        arg: "cors.origin",
    },
    "httpActions.enabled": {
        env: "SOCKETHUB_HTTP_ACTIONS_ENABLED",
        emptyEnvIsUnset: true,
    },
    "httpActions.path": {
        env: "SOCKETHUB_HTTP_ACTIONS_PATH",
        emptyEnvIsUnset: true,
    },
    "httpActions.requireRequestId": {
        env: "SOCKETHUB_HTTP_ACTIONS_REQUIRE_REQUEST_ID",
        emptyEnvIsUnset: true,
    },
    "httpActions.maxMessagesPerRequest": {
        format: "nat",
        env: "SOCKETHUB_HTTP_ACTIONS_MAX_MESSAGES_PER_REQUEST",
        emptyEnvIsUnset: true,
    },
    "httpActions.maxPayloadBytes": {
        format: "nat",
        env: "SOCKETHUB_HTTP_ACTIONS_MAX_PAYLOAD_BYTES",
        emptyEnvIsUnset: true,
    },
    "httpActions.idempotencyTtlMs": {
        format: "nat",
        env: "SOCKETHUB_HTTP_ACTIONS_IDEMPOTENCY_TTL_MS",
        emptyEnvIsUnset: true,
    },
    "httpActions.requestTimeoutMs": {
        format: "nat",
        env: "SOCKETHUB_HTTP_ACTIONS_REQUEST_TIMEOUT_MS",
        emptyEnvIsUnset: true,
    },
    "httpActions.idleTimeoutMs": {
        format: "nat",
        env: "SOCKETHUB_HTTP_ACTIONS_IDLE_TIMEOUT_MS",
        emptyEnvIsUnset: true,
    },
    "platformHeartbeat.intervalMs": {
        format: "nat",
        env: "SOCKETHUB_PLATFORM_HEARTBEAT_INTERVAL_MS",
        emptyEnvIsUnset: true,
    },
    "platformHeartbeat.timeoutMs": {
        format: "nat",
        env: "SOCKETHUB_PLATFORM_HEARTBEAT_TIMEOUT_MS",
        emptyEnvIsUnset: true,
    },
};

function isLeaf(node: JsonSchemaNode, overlay?: OverlayEntry): boolean {
    if (overlay?.leaf) {
        return true;
    }
    return !(node.type === "object" && node.properties);
}

function hasDefault(node: JsonSchemaNode, overlay?: OverlayEntry): boolean {
    return (
        Object.hasOwn(node, "default") ||
        (overlay !== undefined && Object.hasOwn(overlay, "default"))
    );
}

function defaultOf(node: JsonSchemaNode, overlay?: OverlayEntry): unknown {
    const value = Object.hasOwn(node, "default")
        ? node.default
        : overlay?.default;
    // Clone object/array defaults so convict instances never share state.
    return value !== null && typeof value === "object"
        ? structuredClone(value)
        : value;
}

function convictFormat(
    node: JsonSchemaNode,
    path: string,
    overlay?: OverlayEntry,
): unknown {
    if (overlay?.format !== undefined) {
        return overlay.format;
    }
    if (Array.isArray(node.enum)) {
        return [...node.enum];
    }
    if (Array.isArray(node.type)) {
        // Union types (e.g. ["number", "null"]) have no convict equivalent;
        // the JSON schema validation pass enforces them.
        return "*";
    }
    switch (node.type) {
        case "boolean":
            return Boolean;
        case "string":
            return String;
        case "number":
        case "integer":
            return Number;
        case "array":
            return Array;
        case "object":
            return Object;
        default:
            throw new Error(
                `config schema: unsupported type "${node.type}" at "${path}"`,
            );
    }
}

function buildDefinition(
    node: JsonSchemaNode,
    overlays: Record<string, OverlayEntry>,
    consumed: Set<string>,
    prefix = "",
): Record<string, unknown> {
    const definition: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node.properties ?? {})) {
        const path = prefix ? `${prefix}.${key}` : key;
        const overlay = overlays[path];
        if (overlay) {
            consumed.add(path);
        }
        if (!isLeaf(child, overlay)) {
            definition[key] = buildDefinition(child, overlays, consumed, path);
            continue;
        }
        if (!hasDefault(child, overlay)) {
            throw new Error(
                `config schema: no default declared for "${path}" in the ` +
                    "JSON schema or its overlay entry",
            );
        }
        const leaf: Record<string, unknown> = {
            format: convictFormat(child, path, overlay),
            default: defaultOf(child, overlay),
        };
        if (child.description) {
            leaf.doc = child.description;
        }
        if (overlay?.env) {
            leaf.env = overlay.env;
        }
        if (overlay?.arg) {
            leaf.arg = overlay.arg;
        }
        definition[key] = leaf;
    }
    return definition;
}

/**
 * Build the convict schema definition from a JSON schema plus a server
 * overlay. Exported for tests; production code uses {@link buildSchema}.
 * Throws when an overlay entry references a path the JSON schema does not
 * declare, or when a leaf ends up without a default.
 */
export function buildConvictDefinition(
    jsonSchema: JsonSchemaNode,
    overlays: Record<string, OverlayEntry>,
): Record<string, unknown> {
    const consumed = new Set<string>();
    const definition = buildDefinition(jsonSchema, overlays, consumed);
    const unknown = Object.keys(overlays).filter((path) => !consumed.has(path));
    if (unknown.length > 0) {
        throw new Error(
            "config schema: overlay entries reference paths missing from " +
                `the JSON schema: ${unknown.join(", ")}`,
        );
    }
    return definition;
}

export function buildSchema(): convict.Config<Record<string, unknown>> {
    return convict(
        buildConvictDefinition(
            SockethubConfigSchema as JsonSchemaNode,
            OVERLAY,
        ),
    );
}

/**
 * Environment variables where an empty-string value means "unset" rather
 * than an override (historical `process.env.X || <config>` semantics).
 */
export const EMPTY_ENV_IS_UNSET_VARS: ReadonlyArray<string> = Object.values(
    OVERLAY,
)
    .filter((entry) => entry.emptyEnvIsUnset && entry.env)
    .map((entry) => entry.env as string);

function collectDefaults(
    node: JsonSchemaNode,
    overlays: Record<string, OverlayEntry>,
    prefix = "",
): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node.properties ?? {})) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (path === "$schema") {
            continue;
        }
        const overlay = overlays[path];
        defaults[key] = isLeaf(child, overlay)
            ? defaultOf(child, overlay)
            : collectDefaults(child, overlays, path);
    }
    return defaults;
}

/**
 * The fully materialized default configuration tree, straight from the JSON
 * schema (no environment or command-line overrides applied). The `$schema`
 * key is omitted; callers stamp their own reference.
 */
export function getDefaultConfig(): Record<string, unknown> {
    return collectDefaults(SockethubConfigSchema as JsonSchemaNode, OVERLAY);
}
