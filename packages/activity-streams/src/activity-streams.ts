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
    ],
};
const rename = {
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
};

type CustomProps = {
    [key: string]: string | number | boolean | object;
};

const objs = new Map();
const customProps: CustomProps = {};

let failOnUnknownObjectProperties = false;
let warnOnUnknownObjectProperties = true;
let specialObjs = []; // the objects don't get rejected for bad props

function matchesCustomProp(type: string, key: string) {
    if (customProps[type] instanceof Object) {
        const obj = customProps[type] as object;
        if (key in obj) {
            return true;
        }
    }
    return false;
}

function renameProp(obj, key: string) {
    obj[rename[key]] = obj[key];
    delete obj[key];
    return obj;
}

function validateObject(type: string, obj: ActivityObject = { type: "" }) {
    // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
    const unknownKeys = Object.keys(obj).filter((key): void | string => {
        if (!baseProps[type].includes(key)) {
            return key;
        }
    });

    for (const key of unknownKeys) {
        let ao: ActivityObject = obj;
        if (rename[key]) {
            // rename property instead of fail
            ao = renameProp(obj, key);
            continue;
        }

        if (matchesCustomProp(ao.type, key)) {
            // custom property matches, continue
            continue;
        }

        if (!specialObjs.includes(obj.type)) {
            // not defined as a special prop
            // don't know what to do with it, so throw error
            const err = `invalid property: "${key}"`;
            if (failOnUnknownObjectProperties) {
                throw new Error(err);
            }
            if (warnOnUnknownObjectProperties) {
                console.warn(err);
            }
        }
    }
}

function ensureProps(obj) {
    // ensure the name property, which can generally be inferred from the id
    // name = obj.match(/(?(?\w+):\/\/)(?:.+@)?(.+?)(?:\/|$)/)[1]
    return obj;
}

function expandStream(meta) {
    const stream = {};
    for (const key of Object.keys(meta)) {
        if (typeof meta[key] === "string") {
            stream[key] = objs.get(meta[key]) || meta[key];
        } else if (Array.isArray(meta[key])) {
            stream[key] = [];
            for (const entry of meta[key]) {
                if (typeof entry === "string") {
                    stream[key].push(objs.get(entry) || entry);
                }
            }
        } else {
            stream[key] = meta[key];
        }
    }

    // only expand string into objects if they are in the expand list
    for (const key of Object.keys(expand)) {
        if (typeof stream[key] === "string") {
            const idx = expand[key].primary;
            const obj = {};
            obj[idx] = stream[key];
            stream[key] = obj;
        }
    }
    return stream;
}

function Stream(meta): ActivityStream | ActivityObject | Record<string, never> {
    validateObject("stream", meta);
    if (typeof meta.object === "object") {
        validateObject("object", meta.object);
    }
    const stream = expandStream(meta);
    ee.emit("activity-stream", stream);
    return stream;
}

export interface ActivityObjectManager {
    create(obj: unknown): unknown;
    delete(id: string): boolean;
    list(): IterableIterator<unknown>;
    get(id: string, expand?: boolean): unknown;
}

const _Object: ActivityObjectManager = {
    create: (obj: ActivityObject) => {
        validateObject("object", obj);
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
            obj = { id: id };
        }
        return ensureProps(obj);
    },

    list: (): IterableIterator<unknown> => objs.keys(),
};

export interface ASFactoryOptions {
    specialObjs?: Array<string>;
    failOnUnknownObjectProperties?: boolean;
    warnOnUnknownObjectProperties?: boolean;
    customProps?: CustomProps;
}

export interface ASManager {
    Stream(meta: unknown): unknown;
    Object: ActivityObjectManager;
    on(event, func): void;
    once(event, func): void;
    off(event, funcName): void;
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
    for (const propName of Object.keys(opts.customProps || {})) {
        if (typeof opts.customProps[propName] === "object") {
            customProps[propName] = opts.customProps[propName];
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
