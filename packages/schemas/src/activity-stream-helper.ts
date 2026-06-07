import { ObjectTypesSchema } from "./helpers/objects.js";
import { ActivityStreamSchema } from "./schemas/activity-stream.js";
import type { ActivityObject, ActivityStream } from "./types.js";

const streamProps = new Set(
    Object.keys(ActivityStreamSchema.properties).concat("platform"),
);

const genericObjectProps = new Set<string>();
const objectPropsByType = new Map<string, Set<string>>();
const permissiveObjectTypes = new Set<string>();

for (const [type, schema] of Object.entries(ObjectTypesSchema)) {
    const objectSchema = schema as {
        additionalProperties?: boolean;
        properties?: Record<string, unknown>;
    };
    const objectProps = Object.keys(objectSchema.properties || {});
    for (const prop of objectProps) {
        genericObjectProps.add(prop);
    }
    objectPropsByType.set(type, new Set(objectProps));
    if (objectSchema.additionalProperties === true) {
        permissiveObjectTypes.add(type);
    }
}

const stringRefKeys = {
    actor: "id",
    target: "id",
    object: "content",
} as const;

type StreamPartKey = keyof typeof stringRefKeys;

export interface ActivityStreamProcessorOptions {
    /** Object types that skip unknown-property lint (e.g. credentials). */
    looseObjectTypes?: string[];
    failOnUnknownProperties?: boolean;
    warnOnUnknownProperties?: boolean;
    /** Initial per-type extension property names (merged with registerObjectTypeExtensions). */
    objectTypeExtensions?: Record<string, string[]>;
    /** Called when warnOnUnknownProperties is true. Defaults to console.warn. */
    onWarn?: (message: string) => void;
}

export interface ActivityStreamProcessor {
    process(meta: unknown): ActivityStream;
    registerObjectTypeExtensions(type: string, props: string[]): void;
}

export interface JsonSchemaLike {
    properties?: Record<string, JsonSchemaLike & { enum?: string[] }>;
    oneOf?: JsonSchemaLike[];
    anyOf?: JsonSchemaLike[];
    allOf?: JsonSchemaLike[];
}

function formatUnknownPropertyValue(value: unknown): string {
    if (typeof value === "string") {
        return `"${value}"`;
    }
    if (value && typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch (_err) {
            return String(value);
        }
    }
    return String(value);
}

function normalizeStringRef(value: unknown, primaryKey: string): unknown {
    if (typeof value === "string") {
        return { [primaryKey]: value };
    }
    if (Array.isArray(value)) {
        return value.map((entry) => {
            if (typeof entry === "string") {
                return { id: entry };
            }
            return entry;
        });
    }
    return value;
}

/**
 * Normalize string actor/target/object refs into minimal ActivityObjects.
 */
export function normalizeActivityStream(meta: ActivityStream): ActivityStream {
    const stream: Record<string, unknown> = {
        ...(meta as unknown as Record<string, unknown>),
    };
    for (const key of Object.keys(stringRefKeys) as StreamPartKey[]) {
        if (key in stream) {
            stream[key] = normalizeStringRef(stream[key], stringRefKeys[key]);
        }
    }
    return stream as ActivityStream;
}

/**
 * Walk a platform message JSON Schema and collect object `type` → property names
 * for activity stream linting after schema registry load.
 */
export function extractObjectPropertyExtensionsFromMessageSchema(
    schema: unknown,
): Array<{ type: string; props: string[] }> {
    if (!schema || typeof schema !== "object") {
        return [];
    }
    const results: Array<{ type: string; props: string[] }> = [];
    const walk = (entry: JsonSchemaLike) => {
        const nested = [entry.oneOf, entry.anyOf, entry.allOf]
            .filter(Array.isArray)
            .flat() as JsonSchemaLike[];
        for (const child of nested) {
            walk(child);
        }
        const objectSchema = entry.properties?.object;
        if (objectSchema) {
            walk(objectSchema);
            const typeEnum = objectSchema.properties?.type?.enum;
            const objectType = typeEnum?.find(
                (value): value is string => typeof value === "string",
            );
            if (objectType && objectSchema.properties) {
                results.push({
                    type: objectType,
                    props: Object.keys(objectSchema.properties),
                });
            }
        }
    };
    walk(schema as JsonSchemaLike);
    return results;
}

export function createActivityStreamProcessor(
    opts: ActivityStreamProcessorOptions = {},
): ActivityStreamProcessor {
    const looseObjectTypes = new Set(opts.looseObjectTypes || ["credentials"]);
    const failOnUnknownObjectProperties = opts.failOnUnknownProperties ?? false;
    const warnOnUnknownObjectProperties = opts.warnOnUnknownProperties ?? true;
    const onWarn = opts.onWarn ?? ((message: string) => console.warn(message));
    const objectTypeExtensions: Record<string, Set<string>> = {};

    for (const [type, props] of Object.entries(
        opts.objectTypeExtensions || {},
    )) {
        objectTypeExtensions[type] = new Set(props);
    }

    function registerObjectTypeExtensions(type: string, props: string[]) {
        if (typeof type !== "string" || !Array.isArray(props)) {
            return;
        }
        const current = new Set(objectTypeExtensions[type] || []);
        for (const prop of props) {
            if (typeof prop === "string" && prop.length > 0) {
                current.add(prop);
            }
        }
        objectTypeExtensions[type] = current;
    }

    function getAllowedObjectProps(type: string): Set<string> {
        const props = new Set(
            objectPropsByType.get(type) || genericObjectProps,
        );
        for (const prop of objectTypeExtensions[type] || []) {
            props.add(prop);
        }
        return props;
    }

    function lintObject(part: "stream" | "object", incomingObj: unknown): void {
        if (incomingObj === null) {
            throw new Error(
                `ActivityStreams validation failed: the "${part}" property is null. Example: { id: "user@example.com", type: "person" }`,
            );
        }
        if (incomingObj === undefined) {
            throw new Error(
                `ActivityStreams validation failed: the "${part}" property is undefined. Example: { id: "user@example.com", type: "person" }`,
            );
        }
        if (typeof incomingObj === "string") {
            throw new Error(
                `ActivityStreams validation failed: the "${part}" property received string "${incomingObj}" but expected an object. Use: { id: "${incomingObj}", type: "person" }`,
            );
        }
        if (typeof incomingObj !== "object" || Array.isArray(incomingObj)) {
            const receivedType = Array.isArray(incomingObj)
                ? "array"
                : typeof incomingObj;
            throw new Error(
                `ActivityStreams validation failed: the "${part}" property must be an object, received ${receivedType} (${String(incomingObj)}). Example: { id: "user@example.com", type: "person" }`,
            );
        }

        const incomingRecord = incomingObj as Record<string, unknown>;
        const allowedProps =
            part === "stream"
                ? streamProps
                : getAllowedObjectProps(String(incomingRecord.type));
        const unknownKeys = Object.keys(incomingRecord).filter(
            (key) => !allowedProps.has(key),
        );

        for (const key of unknownKeys) {
            const ao = incomingObj as ActivityObject;
            if (
                !looseObjectTypes.has(ao.type) &&
                !(part === "object" && permissiveObjectTypes.has(ao.type))
            ) {
                const receivedValue = formatUnknownPropertyValue(ao[key]);
                const err = `ActivityStreams validation failed: property "${key}" with value ${receivedValue} is not allowed on the "${part}" object of type "${ao.type}".`;
                if (failOnUnknownObjectProperties) {
                    throw new Error(err);
                }
                if (warnOnUnknownObjectProperties) {
                    onWarn(err);
                }
            }
        }
    }

    function process(meta: unknown): ActivityStream {
        lintObject("stream", meta);
        if (typeof (meta as ActivityStream).object === "object") {
            lintObject("object", (meta as ActivityStream).object);
        }
        return normalizeActivityStream(meta as ActivityStream);
    }

    return {
        process,
        registerObjectTypeExtensions,
    };
}
