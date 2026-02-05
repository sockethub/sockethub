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
import EventEmitter from "eventemitter3";

const ee = new EventEmitter();
const baseProps = {
    stream: [
        "id",
        "type",
        "actor",
        "target",
        "object",
        "context",
        "context",
        "published",
        "error",
    ],
    object: [
        "id",
        "type",
        "context",
        "alias",
        "attachedTo",
        "attachment",
        "attributedTo",
        "attributedWith",
        "condition",
        "content",
        "contentMap",
        "context",
        "contextOf",
        "name",
        "endTime",
        "generator",
        "generatorOf",
        "group",
        "icon",
        "image",
        "inReplyTo",
        "members",
        "memberOf",
        "message",
        "location",
        "locationOf",
        "objectOf",
        "originOf",
        "presence",
        "preview",
        "previewOf",
        "provider",
        "providerOf",
        "published",
        "rating",
        "relationship",
        "resultOf",
        "replies",
        "role",
        "scope",
        "scopeOf",
        "startTime",
        "status",
        "summary",
        "topic",
        "tag",
        "tagOf",
        "targetOf",
        "title",
        "titleMap",
        "updated",
        "url",
        "xmpp:stanza-id",
    ],
} as const;
const rename: Record<string, string> = {
    "@id": "id",
    "@type": "type",
    verb: "type",
    displayName: "name",
    objectType: "type",
    platform: "context",
};
const expand = {
    actor: {
        primary: "id",
        props: baseProps,
    },
    target: {
        primary: "id",
        props: baseProps,
    },
    object: {
        primary: "content",
        props: baseProps,
    },
} as const;

type CustomProps = Record<string, string[]>;

type BasePropKey = keyof typeof baseProps;

const objs = new Map<string, ActivityObject>();
const customProps: CustomProps = {};

let failOnUnknownObjectProperties = false;
let warnOnUnknownObjectProperties = true;
let specialObjs: string[] = []; // the objects don't get rejected for bad props

function matchesCustomProp(type: string, key: string) {
    const props = customProps[type];
    return Array.isArray(props) && props.includes(key);
}

function renameProp(obj: Record<string, unknown>, key: string) {
    const renameKey = rename[key];
    if (!renameKey) {
        return obj;
    }
    obj[renameKey] = obj[key];
    delete obj[key];
    return obj;
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
    const allowedProps = baseProps[type] as readonly string[];
    const unknownKeys = Object.keys(incomingRecord).filter(
        (key: string): boolean => {
            return !allowedProps.includes(key);
        },
    );

    for (const key of unknownKeys) {
        const ao = incomingObj as ActivityObject;
        if (rename[key]) {
            // rename property instead of fail
            renameProp(ao as Record<string, unknown>, key);
            continue;
        }

        if (matchesCustomProp(ao.type, key)) {
            // custom property matches, continue
            continue;
        }

        if (!specialObjs.includes(ao.type)) {
            // not defined as a special prop
            // don't know what to do with it, so throw error
            console.log(ao);
            const receivedValue =
                typeof ao[key] === "string" ? `"${ao[key]}"` : String(ao[key]);
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

function ensureProps(obj: ActivityObject): ActivityObject {
    // ensure the name property, which can generally be inferred from the id
    // name = obj.match(/(?(?\w+):\/\/)(?:.+@)?(.+?)(?:\/|$)/)[1]
    return obj;
}

function expandStream(meta: ActivityStream) {
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

function Stream(
    meta: ActivityStream,
): ActivityStream | ActivityObject | Record<string, never>;
function Stream(
    meta: unknown,
): ActivityStream | ActivityObject | Record<string, never>;
function Stream(
    meta: ActivityStream | unknown,
): ActivityStream | ActivityObject | Record<string, never> {
    validateObject("stream", meta);
    if (typeof (meta as ActivityStream).object === "object") {
        validateObject("object", (meta as ActivityStream).object);
    }
    const stream = expandStream(meta as ActivityStream);
    ee.emit("activity-stream", stream);
    return stream;
}

export interface ActivityObjectManager {
    create(obj: ActivityObject): ActivityObject;
    delete(id: string): boolean;
    list(): IterableIterator<string>;
    get(id: string, expand?: boolean): ActivityObject | string;
}

const _Object: ActivityObjectManager = {
    create: (obj: ActivityObject) => {
        validateObject("object", obj, true); // require ID for Object.create()
        const ao = ensureProps(obj);
        if (!ao.id) {
            throw new Error("activity object id is required for Object.create");
        }
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
    on(event: string, func: EventCallback): void;
    once(event: string, func: EventCallback): void;
    off(event: string, func: EventCallback): void;
}

export function ASFactory(opts: ASFactoryOptions = {}): ASManager {
    specialObjs = opts?.specialObjs || [];
    failOnUnknownObjectProperties =
        typeof opts.failOnUnknownObjectProperties === "boolean"
            ? opts.failOnUnknownObjectProperties
            : failOnUnknownObjectProperties;
    warnOnUnknownObjectProperties =
        typeof opts.warnOnUnknownObjectProperties === "boolean"
            ? opts.warnOnUnknownObjectProperties
            : warnOnUnknownObjectProperties;
    const customPropsConfig = opts.customProps || {};
    for (const propName of Object.keys(customPropsConfig)) {
        if (Array.isArray(customPropsConfig[propName])) {
            customProps[propName] = customPropsConfig[propName];
        }
    }

    return {
        Stream: Stream,
        Object: _Object,
        on: (event, func) => ee.on(event, func),
        once: (event, func) => ee.once(event, func),
        off: (event, funcName) => ee.off(event, funcName),
    } as ASManager;
}

((global: Record<string, unknown>) => {
    global.ASFactor = ASFactory;
})(
    typeof globalThis === "object"
        ? (globalThis as Record<string, unknown>)
        : {},
);
