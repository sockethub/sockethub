/*!
 * activity-streams
 *   http://github.com/silverbucket/activity-streams
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


const EventEmitter = require('event-emitter');

const ee = EventEmitter(),
      baseProps = {
        stream: [
          '@id', '@type', 'actor', 'target', 'object', '@context', 'context',
          'published', 'error'
        ],
        object: [
          '@id', '@type', '@context',
          'alias', 'attachedTo', 'attachment', 'attributedTo', 'attributedWith',
          'content', 'contentMap', 'context', 'contextOf', 'displayName', 'endTime', 'generator',
          'generatorOf', 'group', 'icon', 'image', 'inReplyTo', 'members', 'memberOf', 
          'message', 'location', 'locationOf', 'objectOf', 'originOf', 'presence', 
          'preview', 'previewOf', 'provider', 'providerOf', 'published', 'rating', 
          'relationship', 'resultOf', 'replies', 'role', 'scope', 'scopeOf', 'startTime', 
          'status', 'summary', 'topic', 'tag', 'tagOf', 'targetOf', 'title', 'titleMap',
          'updated', 'url'
        ]
      },
      rename = {
        'id': '@id',
        'verb': '@type',
        'objectType': '@type',
        'platform': 'context'
      },
      expand = {
        'actor' : {
          'primary': '@id',
          'props': baseProps
        },
        'target': {
          'primary': '@id',
          'props': baseProps
        },
        'object': {
          'primary': 'content',
          'props': baseProps
        }
      };

let objs = new Map(),
    failOnUnknownObjectProperties = false,
    specialObjs = [], // the objects don't get rejected for bad props
    customProps  = {};


function matchesCustomProp(type, key) {
  return !!((typeof customProps[type] === 'object') && (customProps[type].includes(key)));
}

function renameProp(obj, key) {
  obj[rename[key]] = obj[key];
  delete obj[key];
  return obj;
}

function validateObject(type, obj = {}) {
  const unknownKeys = Object.keys(obj).filter((key) => {
    if (! baseProps[type].includes(key)) {
      return key;
    }
  });

  for (let key of unknownKeys) {
    if (rename[key]) {
      // rename property instead of fail
      obj = renameProp(obj, key)
      continue;
    }

    if (matchesCustomProp(obj['@type'], key)) {
      // custom property matches, continue
      continue;
    }

    if (! specialObjs.includes(obj['@type'])) {
      // not defined as a special prop
      // don't know what to do with it, so throw error
      const err = `invalid property: "${key}"`;
      if (failOnUnknownObjectProperties) {
        throw new Error(err);
      } else {
        console.warn(err);
      }
    }
  }
}


function ensureProps(obj) {
  // ensure the displayName property, which can general be inferred from the @id
  // displayName = obj.match(/(?(?\w+):\/\/)(?:.+@)?(.+?)(?:\/|$)/)[1]
  return obj;
}

function expandStream(meta) {
  let stream = {};
  for (let key of Object.keys(meta)) {
    if (typeof meta[key] === 'string') {
      stream[key] = objs.get(meta[key]) || meta[key];
    } else if (Array.isArray(meta[key])) {
      stream[key] = [];
      for (let entry of meta[key]) {
        if (typeof entry === 'string') {
          stream[key].push(objs.get(entry) || entry);
        }
      }
    } else {
      stream[key] = meta[key];
    }
  }

  // only expand string into objects if they are in the expand list
  for (let key of Object.keys(expand)) {
    if (typeof stream[key] === 'string') {
      const idx = expand[key].primary;
      let obj = {};
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
  const stream = expandStream(meta)
  ee.emit('activity-stream', stream);
  return stream;
}


const _Object = {
  create: function (obj) {
    validateObject('object', obj);
    obj = ensureProps(obj);
    objs.set(obj['@id'], obj);
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
    if (! obj) {
      if (! expand) {
        return id;
      }
      obj = {'@id': id};
    }
    return ensureProps(obj);
  },

  list: function () {
    return objs.keys();
  },

  getByType: function (type) {
    // TODO not implemented
  }
};


function ASFactory(opts = {}) {
  specialObjs = opts.specialObjs || [];
  failOnUnknownObjectProperties = opts.failOnUnknownObjectProperties || false;
  for (let propName of Object.keys(opts.customProps || {})) {
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

if (typeof module === 'object' && module.exports) {
  module.exports = ASFactory
}
if (typeof window === 'object') {
  window.ASFactory = ASFactory;
}
