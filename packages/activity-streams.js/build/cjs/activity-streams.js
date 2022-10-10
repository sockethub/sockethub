"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const event_emitter_1 = __importDefault(require("event-emitter"));
const ee = (0, event_emitter_1.default)(), baseProps = {
    stream: [
        'id', 'type', 'actor', 'target', 'object', 'context', 'context',
        'published', 'error'
    ],
    object: [
        'id', 'type', 'context',
        'alias', 'attachedTo', 'attachment', 'attributedTo', 'attributedWith',
        'content', 'contentMap', 'context', 'contextOf', 'name', 'endTime', 'generator',
        'generatorOf', 'group', 'icon', 'image', 'inReplyTo', 'members', 'memberOf',
        'message', 'location', 'locationOf', 'objectOf', 'originOf', 'presence',
        'preview', 'previewOf', 'provider', 'providerOf', 'published', 'rating',
        'relationship', 'resultOf', 'replies', 'role', 'scope', 'scopeOf', 'startTime',
        'status', 'summary', 'topic', 'tag', 'tagOf', 'targetOf', 'title', 'titleMap',
        'updated', 'url'
    ]
}, rename = {
    '@id': 'id',
    '@type': 'type',
    'verb': 'type',
    'displayName': 'name',
    'objectType': 'type',
    'platform': 'context'
}, expand = {
    'actor': {
        'primary': 'id',
        'props': baseProps
    },
    'target': {
        'primary': 'id',
        'props': baseProps
    },
    'object': {
        'primary': 'content',
        'props': baseProps
    }
};
const objs = new Map(), customProps = {};
let failOnUnknownObjectProperties = false, warnOnUnknownObjectProperties = true, specialObjs = []; // the objects don't get rejected for bad props
function matchesCustomProp(type, key) {
    return !!((typeof customProps[type] === 'object') && (customProps[type].includes(key)));
}
function renameProp(obj, key) {
    obj[rename[key]] = obj[key];
    delete obj[key];
    return obj;
}
function validateObject(type, obj = { type: "" }) {
    const unknownKeys = Object.keys(obj).filter((key) => {
        if (!baseProps[type].includes(key)) {
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
            }
            else if (warnOnUnknownObjectProperties) {
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
        if (typeof meta[key] === 'string') {
            stream[key] = objs.get(meta[key]) || meta[key];
        }
        else if (Array.isArray(meta[key])) {
            stream[key] = [];
            for (const entry of meta[key]) {
                if (typeof entry === 'string') {
                    stream[key].push(objs.get(entry) || entry);
                }
            }
        }
        else {
            stream[key] = meta[key];
        }
    }
    // only expand string into objects if they are in the expand list
    for (const key of Object.keys(expand)) {
        if (typeof stream[key] === 'string') {
            const idx = expand[key].primary;
            const obj = {};
            obj[idx] = stream[key];
            stream[key] = obj;
        }
    }
    return stream;
}
function Stream(meta) {
    validateObject('stream', meta);
    if (typeof meta.object === 'object') {
        validateObject('object', meta.object);
    }
    const stream = expandStream(meta);
    ee.emit('activity-stream', stream);
    return stream;
}
const _Object = {
    create: function (obj) {
        validateObject('object', obj);
        obj = ensureProps(obj);
        objs.set(obj.id, obj);
        ee.emit('activity-object-create', obj);
        return obj;
    },
    delete: function (id) {
        const result = objs.delete(id);
        if (result) {
            ee.emit('activity-object-delete', id);
        }
        return result;
    },
    get: function (id, expand) {
        let obj = objs.get(id);
        if (!obj) {
            if (!expand) {
                return id;
            }
            obj = { 'id': id };
        }
        return ensureProps(obj);
    },
    list: function () {
        return objs.keys();
    }
};
function ASFactory(opts = {}) {
    specialObjs = (opts === null || opts === void 0 ? void 0 : opts.specialObjs) || [];
    failOnUnknownObjectProperties = typeof opts.failOnUnknownObjectProperties === 'boolean' ?
        opts.failOnUnknownObjectProperties : failOnUnknownObjectProperties;
    warnOnUnknownObjectProperties = typeof opts.warnOnUnknownObjectProperties === 'boolean' ?
        opts.warnOnUnknownObjectProperties : warnOnUnknownObjectProperties;
    for (const propName of Object.keys(opts.customProps || {})) {
        if (typeof opts.customProps[propName] === 'object') {
            customProps[propName] = opts.customProps[propName];
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
        }
    };
}
exports.default = ASFactory;
//# sourceMappingURL=/activity-streams.js.map