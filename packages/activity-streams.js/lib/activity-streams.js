/*!
 * activity-streams
 *   http://github.com/silverbucket/activity-streams
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net> copyright 2015
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


var EventEmitter = require('event-emitter'),
    ArrayKeys    = require('array-keys');

var objs        = new ArrayKeys({ identifier: '@id' }),
    ee          = EventEmitter(),
    failOnUnknownObjectProperties = false,
    specialObjs = [], // the objects don't get rejected for bad props
    baseProps   = {
      stream: [
        '@id', '@type', 'actor', 'target', 'object', '@context', 'context',
        'published', 'error'
      ],
      object: [
        '@id', '@type', '@context',
        'alias', 'attachedTo', 'attachment', 'attributedTo', 'attributedWith',
        'content', 'context', 'contextOf', 'displayName', 'endTime', 'generator',
        'generatorOf', 'icon', 'image', 'inReplyTo', 'memberOf', 'location',
        'locationOf', 'objectOf', 'originOf', 'presence', 'preview', 'previewOf', 'provider',
        'providerOf', 'published', 'rating', 'resultOf', 'replies', 'scope',
        'scopeOf', 'startTime', 'status', 'summary', 'topic', 'tag', 'tagOf', 'targetOf', 'title',
        'updated', 'url', 'titleMap', 'contentMap', 'members', 'message'
      ]
    },
    customProps  = {},
    rename       = {
      'id': '@id',
      'verb': '@type',
      'objectType': '@type',
      'platform': 'context'
    },
    expand       = {
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
    },
    expandKeys   = Object.keys(expand);

function validateObject(type, obj) {
  var keys = Object.keys(obj);
  for (var i = keys.length - 1; i >= 0; i -= 1) {
    if (baseProps[type].indexOf(keys[i]) < 0) {
      if (rename[keys[i]]) {
        // rename property instead of fail
        obj[rename[keys[i]]] = obj[keys[i]];
        delete obj[keys[i]];
      } else {
        if ((obj['@type']) && (typeof customProps[obj['@type']] === 'object')) {
          if (customProps[obj['@type']].indexOf(keys[i]) >= 0) {
            // custom property matches, continue
            continue;
          }
        }

        if (specialObjs.indexOf(obj['@type']) < 0) {
          return 'invalid property: "' + keys[i] + '"';
        }
      }
    }
  }
  return false;
}

function ensureProps(obj) {
  // ensure the displayName property, which can generall be inferred from the @id
  // displayName = obj.match(/(?(?\w+):\/\/)(?:.+@)?(.+?)(?:\/|$)/)[1]
  return obj;
}

var Stream = function (meta) {
  var stream = {};
  var err = validateObject('stream', meta);

  if (err) {
    throw new Error(err);
  }

  if (typeof meta.object === 'object') {
    err = validateObject('object', meta.object);
    if ((err) && (failOnUnknownObjectProperties)) {
      throw new Error(err);
    } else if (err) {
      console.warn(err);
    }
  }

  for (var key in meta) {

    if (typeof meta[key] === 'string') {
      stream[key] = objs.getRecord(meta[key]) || meta[key];
    } else if (Array.isArray(meta[key])) {
      stream[key] = [];

      for (i = meta[key].length - 1; i >= 0; i -= 1) {
        if (typeof meta[key][i] === 'string') {
          stream[key][i] = objs.getRecord(meta[key][i]) || meta[key][i];
        }
      }
    } else {
      stream[key] = meta[key];
    }
  }

  // only expand string into objects if they are in the expand list
  for (var i = expandKeys.length - 1; i >= 0; i -= 1) {
    if (typeof stream[expandKeys[i]] === 'string') {
      var idx = expand[expandKeys[i]].primary;
      var obj = {};
      obj[idx] = stream[expandKeys[i]];
      stream[expandKeys[i]] = obj;
    }
  }

  ee.emit('activity-stream', stream);
  return stream;
};


var _Object = {
  create: function (obj) {
    var result = false;
    var err = validateObject('object', obj);

    if ((err) && (failOnUnknownObjectProperties)) {
      throw new Error(err);
    } else if (err) {
      console.warn(err);
    }

    obj = ensureProps(obj);

    try {
      result = objs.addRecord(obj);
    } catch (e) {
      throw new Error(e);
    }

    if (result) {
      ee.emit('activity-object-create', obj);
    }
    return result;
  },

  delete: function (id) {
    var result = objs.removeRecord(id);
    if (result) {
      ee.emit('activity-object-delete', id);
    }
    return result;
  },

  get: function (id, doExpand) {
    var r = objs.getRecord(id);
    if (! r) {
      if (doExpand) {
        r = { '@id': id };
      } else {
        return r;
      }
    }
    return ensureProps(r);
  },

  list: function () {
    return objs.getIdentifiers();
  },

  getByType: function (type) {
    objs.forEach(function (o) {
      // TODO not implemented
    });
  }
};


module.exports = function (opts) {
  if (typeof opts === 'object') {
    specialObjs = opts.specialObjs || [];
    failOnUnknownObjectProperties = opts.failOnUnknownObjectProperties || false;
    if (typeof opts.customProps === 'object') {
      var keys = Object.keys(opts.customProps);
      for (var i = 0, len = keys.length; i < len; i += 1) {
        if (typeof opts.customProps[keys[i]] === 'object') {
          customProps[keys[i]] = [];
          for (var j = 0, jlen = opts.customProps[keys[i]].length; j < jlen; j += 1) {
            customProps[keys[i]].push(opts.customProps[keys[i]][j]);
          }
        }
      }
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
};
