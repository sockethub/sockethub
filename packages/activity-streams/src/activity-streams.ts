/*!
 * activity-streams
 *   https://github.com/silverbucket/activity-streams
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net>
 *
 * activity-streams is released under the MIT (see LICENSE).
 *
 * You don't have to do anything special to choose one license or the other
 * and you don't have to notify anyone which license you are using.
 * Please see the corresponding license file for details of these licenses.
 * You are free to use, modify and distribute this software, but all copyright
 * information must remain.
 *
 */

import type { ActivityObject, ActivityStream } from "@sockethub/schemas";
import {
    AS2_BASE_CONTEXT_URL,
    PLATFORM_CONTEXT_PREFIX,
    SOCKETHUB_BASE_CONTEXT_URL,
} from "@sockethub/schemas/context";
import {
    ActivityStreamSchema,
    ObjectTypesSchema,
} from "@sockethub/schemas/object-types";
import EventEmitter from "eventemitter3";

const streamProps = Object.keys(ActivityStreamSchema.properties).concat(
    "platform",
);
const genericObjectProps = new Set<string>();
const objectPropsByType = new Map<string, Set<string>>();
const permissiveObjectTypes = new Set<string>();

// Keep ActivityStreams object property checks aligned with @sockethub/schemas.
// Platforms can still add runtime properties through registerObjectProps().
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

const expand = {
    actor: {
        primary: "id",
    },
    target: {
        primary: "id",
    },
    object: {
        primary: "content",
    },
} as const;

type CustomProps = Record<string, string[]>;

type BasePropKey = "stream" | "object";

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

function ensureProps(obj: ActivityObject): ActivityObject {
    // ensure the name property, which can generally be inferred from the id
    // name = obj.match(/(?(?\w+):\/\/)(?:.+@)?(.+?)(?:\/|$)/)[1]
    return obj;
}

function expandStream(
    meta: ActivityStream,
    objs: Map<string, ActivityObject>,
): ActivityStream {
    const stream: Record<string, unknown> = {};
    const metaRecord = meta as unknown as Record<string, unknown>;
    for (const key of Object.keys(metaRecord)) {
        const value = metaRecord[key];
        if (typeof value === "string") {
            stream[key] = objs.get(value) || value;
        } else if (Array.isArray(value)) {
            const expanded: Array<ActivityObject | string> = [];
            for (const entry of value) {
                if (typeof entry === "string") {
                    expanded.push(objs.get(entry) || entry);
                }
            }
            stream[key] = expanded;
        } else {
            stream[key] = value;
        }
    }

    // only expand string into objects if they are in the expand list
    for (const key of Object.keys(expand) as Array<keyof typeof expand>) {
        const value = stream[key];
        if (typeof value === "string") {
            const idx = expand[key].primary;
            stream[key] = { [idx]: value };
        }
    }
    return stream as unknown as ActivityStream;
}

export interface ActivityObjectManager {
    create(obj: ActivityObject): ActivityObject;
    delete(id: string): boolean;
    list(): IterableIterator<string>;
    get(id: string, expand?: boolean): ActivityObject | string;
}

export interface ASFactoryOptions {
    specialObjs?: Array<string>;
    failOnUnknownObjectProperties?: boolean;
    warnOnUnknownObjectProperties?: boolean;
    customProps?: CustomProps;
}

type EventCallback = (...args: unknown[]) => void;

export interface ASManager {
    Stream(meta: ActivityStream | unknown): ActivityStream | ActivityObject;
    Object: ActivityObjectManager;
    registerObjectProps(type: string, props: string[]): void;
    on(event: string, func: EventCallback): void;
    once(event: string, func: EventCallback): void;
    off(event: string, func: EventCallback): void;
}

export function ASFactory(opts: ASFactoryOptions = {}): ASManager {
    const ee = new EventEmitter();
    const objs = new Map<string, ActivityObject>();
    const customProps: CustomProps = {};
    const instanceSpecialObjs: string[] = opts.specialObjs || [];
    const failOnUnknownObjectProperties =
        typeof opts.failOnUnknownObjectProperties === "boolean"
            ? opts.failOnUnknownObjectProperties
            : false;
    const warnOnUnknownObjectProperties =
        typeof opts.warnOnUnknownObjectProperties === "boolean"
            ? opts.warnOnUnknownObjectProperties
            : true;

    const customPropsConfig = opts.customProps || {};
    for (const propName of Object.keys(customPropsConfig)) {
        customProps[propName] = customPropsConfig[propName];
    }

    function matchesCustomProp(type: string, key: string): boolean {
        const props = customProps[type];
        return Array.isArray(props) && props.includes(key);
    }

    function registerObjectProps(type: string, props: string[]): void {
        if (typeof type !== "string" || !Array.isArray(props)) {
            return;
        }
        // Merge, rather than replace, so schema updates from multiple platforms do
        // not drop base object properties or earlier registrations for the type.
        const current = new Set(customProps[type] || []);
        for (const prop of props) {
            if (typeof prop === "string" && prop.length > 0) {
                current.add(prop);
            }
        }
        customProps[type] = [...current];
    }

    function getAllowedObjectProps(type: string): Set<string> {
        const props = new Set(
            objectPropsByType.get(type) || genericObjectProps,
        );
        for (const prop of customProps[type] || []) {
            props.add(prop);
        }
        return props;
    }

    function validateObject(
        type: BasePropKey,
        incomingObj: unknown,
        requireId = false,
    ) {
        // Input validation with clear error messages
        if (incomingObj === null) {
            throw new Error(
                `ActivityStreams validation failed: the "${type}" property is null. Example: { id: "user@example.com", type: "person" }`,
            );
        }

        if (incomingObj === undefined) {
            throw new Error(
                `ActivityStreams validation failed: the "${type}" property is undefined. Example: { id: "user@example.com", type: "person" }`,
            );
        }

        if (typeof incomingObj === "string") {
            throw new Error(
                `ActivityStreams validation failed: the "${type}" property received string "${incomingObj}" but expected an object. Use: { id: "${incomingObj}", type: "person" }`,
            );
        }

        if (typeof incomingObj !== "object" || Array.isArray(incomingObj)) {
            const receivedType = Array.isArray(incomingObj)
                ? "array"
                : typeof incomingObj;
            const receivedValue = String(incomingObj);
            throw new Error(
                `ActivityStreams validation failed: the "${type}" property must be an object, received ${receivedType} (${receivedValue}). Example: { id: "user@example.com", type: "person" }`,
            );
        }

        // Require 'id' property when explicitly requested (e.g., Object.create())
        const obj = incomingObj as ActivityObject;
        if (requireId && !obj.id) {
            throw new Error(
                `ActivityStreams validation failed: the "${type}" property requires an 'id' property. Example: { id: "user@example.com", type: "person" }`,
            );
        }

        const incomingRecord = incomingObj as Record<string, unknown>;
        const allowedProps =
            type === "stream"
                ? new Set(streamProps)
                : getAllowedObjectProps(String(incomingRecord.type));
        const unknownKeys = Object.keys(incomingRecord).filter(
            (key: string): boolean => {
                return !allowedProps.has(key);
            },
        );

        for (const key of unknownKeys) {
            const ao = incomingObj as ActivityObject;
            if (matchesCustomProp(ao.type, key)) {
                // custom property matches, continue
                continue;
            }

            if (
                !instanceSpecialObjs.includes(ao.type) &&
                !(type === "object" && permissiveObjectTypes.has(ao.type))
            ) {
                // Closed object schemas warn or fail on unknown properties.
                // Permissive schema types, such as message, intentionally allow
                // protocol metadata like xmpp:replace without per-property lists.
                const receivedValue = formatUnknownPropertyValue(ao[key]);
                const err = `ActivityStreams validation failed: property "${key}" with value ${receivedValue} is not allowed on the "${type}" object of type "${ao.type}".`;
                if (failOnUnknownObjectProperties) {
                    throw new Error(err);
                }
                if (warnOnUnknownObjectProperties) {
                    console.warn(err);
                }
            }
        }
    }

    function Stream(
        meta: unknown,
    ): ActivityStream | ActivityObject | Record<string, never> {
        validateObject("stream", meta);
        if (typeof (meta as ActivityStream).object === "object") {
            validateObject("object", (meta as ActivityStream).object);
        }
        const stream = expandStream(meta as ActivityStream, objs);
        ee.emit("activity-stream", stream);
        return stream;
    }

    const instanceObject: ActivityObjectManager = {
        create: (obj: ActivityObject) => {
            validateObject("object", obj, true); // require ID for Object.create()
            const ao = ensureProps(obj);
            objs.set(ao.id, ao);
            ee.emit("activity-object-create", ao);
            return ao;
        },

        delete: (id) => {
            const result = objs.delete(id);
            if (result) {
                ee.emit("activity-object-delete", id);
            }
            return result;
        },

        get: (id, expand) => {
            let obj = objs.get(id);
            if (!obj) {
                if (!expand) {
                    return id;
                }
                obj = { id: id } as ActivityObject;
            }
            return ensureProps(obj);
        },

        list: (): IterableIterator<string> => objs.keys(),
    };

    return {
        Stream: Stream,
        Object: instanceObject,
        registerObjectProps,
        on: (event, func) => ee.on(event, func),
        once: (event, func) => ee.once(event, func),
        off: (event, funcName) => ee.off(event, funcName),
    } as ASManager;
}

((global: Record<string, unknown>) => {
    global.ASFactory = ASFactory;
})(
    typeof globalThis === "object"
        ? (globalThis as Record<string, unknown>)
        : {},
);

export {
    AS2_BASE_CONTEXT_URL,
    PLATFORM_CONTEXT_PREFIX,
    SOCKETHUB_BASE_CONTEXT_URL,
};

/**
 * Build the canonical Sockethub @context array for a platform name.
 */
export function buildCanonicalContext(platform: string): string[] {
    const platformUrl = platform.startsWith("https://")
        ? platform
        : `${PLATFORM_CONTEXT_PREFIX}${platform}/v1.jsonld`;
    return [AS2_BASE_CONTEXT_URL, SOCKETHUB_BASE_CONTEXT_URL, platformUrl];
}

/**
 * Extract the platform ID from a canonical @context array.
 * Returns undefined if no platform context URL is found.
 */
export function platformIdFromContext(
    context: string[] | unknown,
): string | undefined {
    if (!Array.isArray(context)) {
        return undefined;
    }
    for (const entry of context) {
        if (
            typeof entry === "string" &&
            entry.startsWith(PLATFORM_CONTEXT_PREFIX)
        ) {
            const rest = entry.slice(PLATFORM_CONTEXT_PREFIX.length);
            const slashIdx = rest.indexOf("/");
            if (slashIdx > 0) {
                return rest.slice(0, slashIdx);
            }
        }
    }
    return undefined;
}
