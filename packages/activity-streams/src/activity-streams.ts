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

import EventEmitter from 'eventemitter3';
import { IActivityObject, IActivityStream } from '@sockethub/schemas';

interface UnknownActivityObject extends Omit<IActivityObject, 'type'> {
  type?: string;
  "@id"?: string;
  "@type"?: string;
  verb?: string;
  displayName?: string;
  objectType?: string;
  platform?: string;
}

export type StreamResult = IActivityStream;
export type CustomProps = Record<string, Array<string>>;

const ee = new EventEmitter(),
      baseProps = {
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
      },
      rename = {
        '@id': 'id',
        '@type': 'type',
        'verb': 'type',
        'displayName': 'name',
        'objectType': 'type',
        'platform': 'context'
      },
      expand = {
        'actor' : {
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

const activityObjects: Map<string, IActivityObject> = new Map(),
      customProps: CustomProps = {};

let failOnUnknownObjectProperties = false,
    warnOnUnknownObjectProperties = true,
    specialObjs: SpecialObjects = []; // the objects don't get rejected for bad props

function matchesCustomProp(type: string, key: string) {
  return ((typeof customProps[type] === 'object') && (customProps[type].includes(key)));
}

function renameProp(obj: UnknownActivityObject, key: string): IActivityObject {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  obj[rename[key]] = obj[key];
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  delete obj[key];
  return <IActivityObject>obj;
}

function validateObject(type: string, obj: UnknownActivityObject = {type:""}) {
  const unknownKeys = Object.keys(obj).filter((key): void|string => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (! baseProps[type].includes(key)) {
      return key;
    }
  });

  for (const key of unknownKeys) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (rename[key]) {
      // rename property instead of fail
      obj = renameProp(obj, key);
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (matchesCustomProp(obj.type, key)) {
      // custom property matches, continue
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (! specialObjs.includes(obj.type)) {
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

function expandStream(meta: IActivityStream): StreamResult {
  const stream = {};
  for (const key of Object.keys(meta)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof meta[key] === 'string') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      stream[key] = activityObjects.get(meta[key]) as IActivityObject || meta[key] as string;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
    } else if (Array.isArray(meta[key])) {
      const list = [];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      for (const entry of meta[key] as Array<unknown>) {
        if (typeof entry === 'string') {
          list.push(activityObjects.get(entry) || entry);
        }
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      stream[key] = list;
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      stream[key] = meta[key];
    }
  }

  // only expand string into objects if they are in the expand list
  for (const key of Object.keys(expand)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (typeof stream[key] === 'string') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const idx = expand[key].primary;
      const obj = {};
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      obj[idx] = stream[key];
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      stream[key] = obj;
    }
  }
  return stream as IActivityStream;
}


function Stream(meta: IActivityStream): StreamResult {
  validateObject('stream', meta);
  if (typeof meta.object === 'object') {
    validateObject('object', meta.object);
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const stream = expandStream(meta);
  ee.emit('activity-stream', stream);
  return stream;
}

export interface ActivityObjectManager {
  create(obj: UnknownActivityObject): IActivityObject;
  delete(id: string): boolean;
  list(): IterableIterator<string>,
  get(id: string, expand?: boolean): IActivityObject|string ;
}

const _Object: ActivityObjectManager = {
  create: function (obj: UnknownActivityObject): IActivityObject {
    validateObject('object', obj);
    activityObjects.set(obj.id as string, obj as IActivityObject);
    ee.emit('activity-object-create', obj);
    return obj as IActivityObject;
  },

  delete: function (id: string): boolean {
    const result = activityObjects.delete(id);
    if (result) {
      ee.emit('activity-object-delete', id);
    }
    return result;
  },

  get: function (id: string, expand = false): IActivityObject|string {
    let obj = activityObjects.get(id);
    if (! obj) {
      if (! expand) {
        return id;
      }
      obj = {'id': id} as IActivityObject;
    }
    return obj;
  },

  list: function (): IterableIterator<string> {
    return activityObjects.keys();
  }
};

type SpecialObjects = Array<string>;
export interface ASFactoryOptions {
  specialObjs?: SpecialObjects;
  failOnUnknownObjectProperties?: boolean;
  warnOnUnknownObjectProperties?: boolean;
  customProps?: CustomProps;
}

export interface ASManager {
  Stream(meta: unknown): StreamResult,
  Object: ActivityObjectManager,
  on(event: string, func: (val: unknown) => void): void;
  once(event: string, func: (val: unknown) => void): void;
  off(event: string, func: (val: unknown) => void): void;
}

export default function ASFactory(opts: ASFactoryOptions = {}): ASManager {
  specialObjs = opts?.specialObjs || [];
  failOnUnknownObjectProperties = typeof opts.failOnUnknownObjectProperties === 'boolean' ?
    opts.failOnUnknownObjectProperties : failOnUnknownObjectProperties;
  warnOnUnknownObjectProperties = typeof opts.warnOnUnknownObjectProperties === 'boolean' ?
    opts.warnOnUnknownObjectProperties : warnOnUnknownObjectProperties;
  for (const propName of Object.keys(opts.customProps || {})) {
    if (opts?.customProps) {
      if (typeof opts?.customProps[propName] === 'object') {
        customProps[propName] = opts.customProps[propName];
      }
    }
  }

  return {
    Stream: Stream,
    Object: _Object,
    on: function (event, func: (val: unknown) => void) {
      return ee.on(event, func);
    },
    once: function (event: string, func: (val: unknown) => void) {
      return ee.once(event, func);
    },
    off: function (event: string, func: (val: unknown) => void) {
      return ee.off(event, func);
    }
  } as ASManager;
}
