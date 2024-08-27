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

import EventEmitter from "npm:eventemitter3";
import { ActivityObject, ActivityStream } from "@sockethub/schemas";

const ee = new EventEmitter(),
    baseProps = {
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
    },
    rename: Record<string, string> = {
        "@id": "id",
        "@type": "type",
        verb: "type",
        displayName: "name",
        objectType: "type",
        platform: "context",
    },
    expand = {
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

const objs = new Map<string, never>(),
    customProps: Record<string, string[]> = {};

let failOnUnknownObjectProperties = false,
    warnOnUnknownObjectProperties = true,
    specialObjs: string[] = []; // the objects don't get rejected for bad props

function matchesCustomProp(type: string, key: string) {
    return !!(
        typeof customProps[type] === "object" && customProps[type].includes(key)
    );
}

function renameProp(obj: Record<string, never>, key: string) {
    obj[rename[key]] = obj[key];
    delete obj[key];
    return obj;
}

function validateObject(type: string, obj: ActivityObject = { type: "" }) {
    const unknownKeys = Object.keys(obj).filter((key): void | string => {
        if (!baseProps[type as keyof typeof baseProps].includes(key)) {
            return key;
        }
    });

    for (const key of unknownKeys) {
        if (rename[key]) {
            // rename property instead of fail
            obj = renameProp(obj, key);
            continue;
        }

        if (matchesCustomProp(obj.type, key)) {
            // custom property matches, continue
            continue;
        }

        if (!specialObjs.includes(obj.type)) {
            // not defined as a special prop
            // don't know what to do with it, so throw error
            const err = `invalid property: "${key}"`;
            if (failOnUnknownObjectProperties) {
                throw new Error(err);
            } else if (warnOnUnknownObjectProperties) {
                console.warn(err);
            }
        }
    }
}

function ensureProps(obj: Record<string, string>) {
    // ensure the name property, which can generally be inferred from the id
    // name = obj.match(/(?(?\w+):\/\/)(?:.+@)?(.+?)(?:\/|$)/)[1]
    return obj;
}

function expandStream(meta: Record<string, string>) {
    const stream: Record<string, ActivityStream[]> = {};
    for (const key of Object.keys(meta)) {
        if (typeof meta[key] === "string") {
            stream[key] = [ objs.get(meta[key]) || meta[key] ];
        } else if (Array.isArray(meta[key])) {
            stream[key] = [];
            for (const entry of [...meta[key]]) {
                if (typeof entry === "string") {
                    stream[key].push(objs.get(entry) || entry);
                }
            }
        } else {
            stream[key] = [...meta[key]];
        }
    }

    // only expand string into objects if they are in the expand list
    for (const key of Object.keys(expand)) {
        if (typeof stream[key] === "string") {
            const idx = expand[key as keyof typeof expand].primary;
            const obj: Record<string, ActivityStream> = {};
            obj[idx] = stream[key];
            stream[key] = [obj];
        }
    }
    return stream;
}

function Stream(meta: ActivityStream): ActivityStream | ActivityObject | Record<string, never> {
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
    list(): IterableIterator<string>;
    get(id: string | ActivityStream, expand?: boolean): unknown;
}

const _Object: ActivityObjectManager = {
    create: function (obj: ActivityObject) {
        validateObject("object", obj);
        obj = ensureProps(obj as never);
        objs.set(obj.id, obj as never);
        ee.emit("activity-object-create", obj);
        return obj;
    },

    delete: function (id) {
        const result = objs.delete(id);
        if (result) {
            ee.emit("activity-object-delete", id);
        }
        return result;
    },

    get: function (id: string, expand: boolean | undefined) {
        let obj: Record<string, string> | undefined = objs.get(id);
        if (!obj) {
            if (!expand) {
                return id;
            }
            obj = { id: id };
        }
        return ensureProps(obj);
    },

    list: function (): IterableIterator<string> {
        return objs.keys();
    },
};

export interface ASFactoryOptions {
    specialObjs?: Array<string>;
    failOnUnknownObjectProperties?: boolean;
    warnOnUnknownObjectProperties?: boolean;
    customProps?: Record<string, string[]>;
}

export interface ASManager {
    Stream(meta: unknown): ActivityStream;
    Object: ActivityObjectManager;
    on(event: string, func: (obj: ActivityStream) => void): void;
    once(event: string, func: (id: string) => void): void;
    off(event: string, funcName: (obj: ActivityStream) => void | string): void;
}

export default function ASFactory(opts: ASFactoryOptions = {}): ASManager {
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
        const addProps = opts.customProps?[propName] : undefined;
        if (typeof addProps === "object") {
            customProps[propName] = opts.customProps![propName];
        }
    }

    return {
        Stream: Stream,
        Object: _Object,
        on: function (event, func) {
            return ee.on(event, func);
        },
        once: function (event, func) {
            return ee.once(event, func);
        },
        off: function (event, funcName) {
            return ee.off(event, funcName);
        },
    } as ASManager;
}
