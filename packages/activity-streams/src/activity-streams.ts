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

import eventEmitter from "npm:eventemitter3";
import type {
    ActivityActor,
    ActivityObject,
    ActivityStream,
} from "@sockethub/schemas";

const EventEmitter = eventEmitter as unknown as typeof eventEmitter.default;

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

const objs = new Map<string, ActivityObject>(),
    customProps: Record<string, string[]> = {};

let failOnUnknownObjectProperties = false,
    warnOnUnknownObjectProperties = true,
    specialObjs: string[] = []; // the objects don't get rejected for bad props

function matchesCustomProp(type: string, key: string) {
    return !!(
        typeof customProps[type] === "object" && customProps[type].includes(key)
    );
}

function renameProp(obj: ActivityObject, key: string): ActivityObject {
    obj[rename[key]] = obj[key];
    delete obj[key];
    return obj;
}

function validateObject(
    type: string,
    obj: ActivityObject | ActivityStream = { type: "" },
) {
    const unknownKeys = Object.keys(obj).filter((key): void | string => {
        if (!baseProps[type as keyof typeof baseProps].includes(key)) {
            return key;
        }
    });

    for (const key of unknownKeys) {
        if (rename[key]) {
            // rename property instead of fail
            obj = renameProp(obj as ActivityObject, key);
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

function ensureProps(obj: ActivityObject) {
    // ensure the name property, which can generally be inferred from the id
    // name = obj.match(/(?(?\w+):\/\/)(?:.+@)?(.+?)(?:\/|$)/)[1]
    return obj;
}

function expandStream(meta: ActivityStream): ActivityStream {
    interface NewStream {
        [key: string]:
            | ActivityObject
            | ActivityActor
            | string
            | Array<string | ActivityObject>;
    }
    const newStream: NewStream = {};

    // for key property in the meta object, we try to expand it if it's a string.
    // if it's an array, we try to expand each string in the array
    for (const k of Object.keys(meta)) {
        const asKey = k as keyof ActivityStream;

        if (typeof meta[asKey] === "string") {
            newStream[asKey] = objs.get(meta[asKey]) as ActivityObject || meta[asKey];
        } else if (Array.isArray(meta[asKey])) {
            newStream[asKey] = [];
            for (const entry of [...meta[asKey]]) {
                if (typeof entry === "string") {
                    newStream[asKey].push(objs.get(entry) || entry);
                }
            }
        } else {
            newStream[asKey] = meta[asKey] as ActivityObject;
        }
    }

    // only expand string into objects if they are in the expand list
    for (const k of Object.keys(expand)) {
        const asKey = k as keyof typeof expand;
        if (typeof newStream[asKey] === "string") {
            const idx = expand[asKey].primary;
            const obj: ActivityObject = {} as ActivityObject;
            obj[idx] = newStream[asKey];
            newStream[asKey] = obj;
        }
    }

    return newStream as unknown as ActivityStream;
}

function Stream(meta: ActivityStream): ActivityStream {
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
        objs.set(obj.id as string, obj as never);
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
        let obj: ActivityObject | undefined = objs.get(id);
        if (!obj) {
            if (!expand) {
                return id;
            }
            obj = { id: id } as ActivityObject;
        }
        return ensureProps(obj as ActivityObject);
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
    on(event: string, func: (obj: ActivityStream | ActivityObject) => void): void;
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
        const addProps = opts.customProps ? [propName] : undefined;
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
