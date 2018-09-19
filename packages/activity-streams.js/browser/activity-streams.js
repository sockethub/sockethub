(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.ActivityStreams = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{"array-keys":2,"event-emitter":17}],2:[function(require,module,exports){
/*!
 * array-keys
 *   version 2.3.1
 *   http://github.com/silverbucket/array-keys
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net> copyright 2015
 *
 * array-keys is released under the MIT license (see LICENSE).
 *
 * You don't have to do anything special to choose one license or the other
 * and you don't have to notify anyone which license you are using.
 * Please see the corresponding license file for details of these licenses.
 * You are free to use, modify and distribute this software, but all copyright
 * information must remain.
 *
 */

var TinyEmitter = require('tiny-emitter');

function ArrayKeys(p) {
  if (typeof p !== 'object') { p = {}; }
  this._identifier = p.identifier || 'id';
  this._store = [];
  this._idx = []; // array of identifier strings for quick lookup
  if (p.emitEvents) {
    this._emitEvents = true;
    this.events = new TinyEmitter();
  } else {
    this._emitEvents = false;
  }
}

ArrayKeys.prototype.emitEvent = function (event, data, dontEmit) {
  if ((this._emitEvents) && (! dontEmit)) {
    this.events.emit(event, data);
  }
};

ArrayKeys.prototype.getIdentifiers = function () {
  var ids = [];
  for (var i = this._store.length - 1; i >= 0; i = i - 1) {
    ids[ids.length] = this._store[i][this._identifier];
  }
  return ids;
};

ArrayKeys.prototype.getRecord = function (id) {
  for (var i = this._store.length - 1; i >= 0; i = i - 1) {
    if (this._store[i][this._identifier] === id) {
      return this._store[i];
    }
  }
  return undefined;
};

ArrayKeys.prototype.exists = function (id) {
  if (this.getIndex(id) >= 0) {
    return true;
  } else {
    return false;
  }
};

// faster than using indexOf
ArrayKeys.prototype.getIndex = function (id) {
  for (var i = this._idx.length - 1; i >= 0; i = i - 1) {
    if (this._idx[i] === id) {
      return i;
    }
  }
  return -1;
};

ArrayKeys.prototype.addRecord = function (record) {
  if (typeof record !== 'object') {
    throw new Error('cannot add non-object records.');
  } else if (!record[this._identifier]) {
    throw new Error('cannot add a record with no `' + this._identifier +
                    '` property specified.');
  }

  var removed = this.removeRecord(record[this._identifier], true);
  this._idx[this._idx.length] = record[this._identifier];
  this._store[this._store.length] = record;
  setTimeout(function () {
    if (removed) {
      setTimeout(this.emitEvent.bind(this, 'update', record), 0);
    } else {
      setTimeout(this.emitEvent.bind(this, 'add', record), 0);
    }
  }.bind(this), 0);
  return true;
};

ArrayKeys.prototype.removeRecord = function (id, dontEmit) {
  var idx  = this.getIndex(id);
  if (idx < 0) {
    return false;
  }

  // start looking for the record at the same point as the idx entry
  for (var i = idx; i >= 0; i = i - 1) {
    if ((this._store[i]) && (this._store[i][this._identifier] === id)) {
      this._store.splice(i, 1);
      this._idx.splice(idx, 1);
      setTimeout(this.emitEvent.bind(this, 'remove', id, dontEmit), 0);
      return true;
    }
  }

  // if it was not found, start at the end and break at the idx number
  for (var n = this._store.length - 1; n >= idx; n = n - 1) {
    if ((this._store[n]) && (this._store[n][this._identifier] === id)) {
      this._store.splice(n, 1);
      this._idx.splice(idx, 1);
      setTimeout(this.emitEvent.bind(this, 'remove', id, dontEmit), 0);
      return true;
    }
  }
  return false;
};

ArrayKeys.prototype.forEachRecord = function (cb) {
  var count = 0;
  var self = this;
  var finished = function () {};

  setTimeout(function () {
    for (var i = self._store.length - 1; i >= 0; i = i - 1) {
      count += 1;
      setTimeout(cb.bind(null, self._store[i], i), 0);
    }
    setTimeout(finished.bind(null, count), 0);
  }, 0);

  return {
    finally: function (func) {
      finished = func;
    }
  };
};

ArrayKeys.prototype.mapRecords = function(cb) {
  var count = 0;
  var self = this;
  var map = [];
  for (var i = self._store.length - 1; i >= 0; i = i - 1) {
    count += 1;
    map.push(cb(self._store[i], i));
  }
  return map;
};

ArrayKeys.prototype.getCount = function () {
  return this._store.length;
};

ArrayKeys.prototype.removeAll = function () {
  for (var i = this._store.length - 1; i >= 0; i = i - 1) {
    delete this._store[i];
  }
  this._store = [];
};

module.exports = ArrayKeys;

},{"tiny-emitter":18}],3:[function(require,module,exports){
'use strict';

var assign        = require('es5-ext/object/assign')
  , normalizeOpts = require('es5-ext/object/normalize-options')
  , isCallable    = require('es5-ext/object/is-callable')
  , contains      = require('es5-ext/string/#/contains')

  , d;

d = module.exports = function (dscr, value/*, options*/) {
	var c, e, w, options, desc;
	if ((arguments.length < 2) || (typeof dscr !== 'string')) {
		options = value;
		value = dscr;
		dscr = null;
	} else {
		options = arguments[2];
	}
	if (dscr == null) {
		c = w = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
		w = contains.call(dscr, 'w');
	}

	desc = { value: value, configurable: c, enumerable: e, writable: w };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

d.gs = function (dscr, get, set/*, options*/) {
	var c, e, options, desc;
	if (typeof dscr !== 'string') {
		options = set;
		set = get;
		get = dscr;
		dscr = null;
	} else {
		options = arguments[3];
	}
	if (get == null) {
		get = undefined;
	} else if (!isCallable(get)) {
		options = get;
		get = set = undefined;
	} else if (set == null) {
		set = undefined;
	} else if (!isCallable(set)) {
		options = set;
		set = undefined;
	}
	if (dscr == null) {
		c = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
	}

	desc = { get: get, set: set, configurable: c, enumerable: e };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

},{"es5-ext/object/assign":4,"es5-ext/object/is-callable":7,"es5-ext/object/normalize-options":11,"es5-ext/string/#/contains":14}],4:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.assign
	: require('./shim');

},{"./is-implemented":5,"./shim":6}],5:[function(require,module,exports){
'use strict';

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== 'function') return false;
	obj = { foo: 'raz' };
	assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
	return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
};

},{}],6:[function(require,module,exports){
'use strict';

var keys  = require('../keys')
  , value = require('../valid-value')

  , max = Math.max;

module.exports = function (dest, src/*, …srcn*/) {
	var error, i, l = max(arguments.length, 2), assign;
	dest = Object(value(dest));
	assign = function (key) {
		try { dest[key] = src[key]; } catch (e) {
			if (!error) error = e;
		}
	};
	for (i = 1; i < l; ++i) {
		src = arguments[i];
		keys(src).forEach(assign);
	}
	if (error !== undefined) throw error;
	return dest;
};

},{"../keys":8,"../valid-value":13}],7:[function(require,module,exports){
// Deprecated

'use strict';

module.exports = function (obj) { return typeof obj === 'function'; };

},{}],8:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.keys
	: require('./shim');

},{"./is-implemented":9,"./shim":10}],9:[function(require,module,exports){
'use strict';

module.exports = function () {
	try {
		Object.keys('primitive');
		return true;
	} catch (e) { return false; }
};

},{}],10:[function(require,module,exports){
'use strict';

var keys = Object.keys;

module.exports = function (object) {
	return keys(object == null ? object : Object(object));
};

},{}],11:[function(require,module,exports){
'use strict';

var forEach = Array.prototype.forEach, create = Object.create;

var process = function (src, obj) {
	var key;
	for (key in src) obj[key] = src[key];
};

module.exports = function (options/*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (options == null) return;
		process(Object(options), result);
	});
	return result;
};

},{}],12:[function(require,module,exports){
'use strict';

module.exports = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],13:[function(require,module,exports){
'use strict';

module.exports = function (value) {
	if (value == null) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{}],14:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? String.prototype.contains
	: require('./shim');

},{"./is-implemented":15,"./shim":16}],15:[function(require,module,exports){
'use strict';

var str = 'razdwatrzy';

module.exports = function () {
	if (typeof str.contains !== 'function') return false;
	return ((str.contains('dwa') === true) && (str.contains('foo') === false));
};

},{}],16:[function(require,module,exports){
'use strict';

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],17:[function(require,module,exports){
'use strict';

var d        = require('d')
  , callable = require('es5-ext/object/valid-callable')

  , apply = Function.prototype.apply, call = Function.prototype.call
  , create = Object.create, defineProperty = Object.defineProperty
  , defineProperties = Object.defineProperties
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , descriptor = { configurable: true, enumerable: false, writable: true }

  , on, once, off, emit, methods, descriptors, base;

on = function (type, listener) {
	var data;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) {
		data = descriptor.value = create(null);
		defineProperty(this, '__ee__', descriptor);
		descriptor.value = null;
	} else {
		data = this.__ee__;
	}
	if (!data[type]) data[type] = listener;
	else if (typeof data[type] === 'object') data[type].push(listener);
	else data[type] = [data[type], listener];

	return this;
};

once = function (type, listener) {
	var once, self;

	callable(listener);
	self = this;
	on.call(this, type, once = function () {
		off.call(self, type, once);
		apply.call(listener, this, arguments);
	});

	once.__eeOnceListener__ = listener;
	return this;
};

off = function (type, listener) {
	var data, listeners, candidate, i;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) return this;
	data = this.__ee__;
	if (!data[type]) return this;
	listeners = data[type];

	if (typeof listeners === 'object') {
		for (i = 0; (candidate = listeners[i]); ++i) {
			if ((candidate === listener) ||
					(candidate.__eeOnceListener__ === listener)) {
				if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
				else listeners.splice(i, 1);
			}
		}
	} else {
		if ((listeners === listener) ||
				(listeners.__eeOnceListener__ === listener)) {
			delete data[type];
		}
	}

	return this;
};

emit = function (type) {
	var i, l, listener, listeners, args;

	if (!hasOwnProperty.call(this, '__ee__')) return;
	listeners = this.__ee__[type];
	if (!listeners) return;

	if (typeof listeners === 'object') {
		l = arguments.length;
		args = new Array(l - 1);
		for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

		listeners = listeners.slice();
		for (i = 0; (listener = listeners[i]); ++i) {
			apply.call(listener, this, args);
		}
	} else {
		switch (arguments.length) {
		case 1:
			call.call(listeners, this);
			break;
		case 2:
			call.call(listeners, this, arguments[1]);
			break;
		case 3:
			call.call(listeners, this, arguments[1], arguments[2]);
			break;
		default:
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) {
				args[i - 1] = arguments[i];
			}
			apply.call(listeners, this, args);
		}
	}
};

methods = {
	on: on,
	once: once,
	off: off,
	emit: emit
};

descriptors = {
	on: d(on),
	once: d(once),
	off: d(off),
	emit: d(emit)
};

base = defineProperties({}, descriptors);

module.exports = exports = function (o) {
	return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
};
exports.methods = methods;

},{"d":3,"es5-ext/object/valid-callable":12}],18:[function(require,module,exports){
function E () {
  // Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
  on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    };

    listener._ = callback
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;

},{}]},{},[1])(1)
});
