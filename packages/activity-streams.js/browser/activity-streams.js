!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Activity=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
/*!
 * activity-streams
 *   version 0.2.3
 *   http://github.com/silverbucket/activity-streams
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net> copyright 2014
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


var EventEmitter = _dereq_('event-emitter'),
    ArrayKeys    = _dereq_('array-keys');

var objs    = new ArrayKeys({ identifier: 'id' }),
    ee      = EventEmitter();

var Stream = function (stream) {
  var actorObj, targetObj, objectObj;
  if ((typeof stream.actor === 'string') &&
      (actorObj = objs.getRecord(stream.actor))) {
    stream.actor = actorObj;
  }

  if ((typeof stream.target === 'string') &&
      (actorObj = objs.getRecord(stream.target))) {
    stream.target = targetObj;
  } else if (Array.isArray(stream.target)) {
    for (var i = stream.target.length - 1; i >= 0; i -= 1) {
      if ((typeof stream.target[i] === 'string') &&
          (targetObj = objs.getRecord(stream.target[i]))) {
        stream.target[i] = targetObj;
      }
    }
  }

  if ((typeof stream.object === 'string') &&
      (objectObj = objs.getRecord(stream.object))) {
    stream.object = objectObj;
  }

  ee.emit('activity-stream', stream);

  return stream;
};


var _Object = {
  create: function (obj) {
    var result = false;
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

  get: function (obj) {
    return objs.getRecord(obj);
  },

  getByType: function (type) {
    objs.forEach(function (o) {

    });
  }
};


module.exports = {
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

},{"array-keys":2,"event-emitter":3}],2:[function(_dereq_,module,exports){
/*!
 * array-keys
 *   version 1.2.1
 *   http://github.com/silverbucket/array-keys
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net> copyright 2014
 *
 * array-keys is released under the LGPL (see LICENSE).
 *
 * You don't have to do anything special to choose one license or the other
 * and you don't have to notify anyone which license you are using.
 * Please see the corresponding license file for details of these licenses.
 * You are free to use, modify and distribute this software, but all copyright
 * information must remain.
 *
 */

function ArrayKeys(p) {
  if (typeof p !== 'object') { p = {}; }
  this.identifier = p.identifier || 'id';
  this.store = [];
  this.idx = []; // array of identifier strings for quick lookup
}

ArrayKeys.prototype.getIdentifiers = function () {
  var ids = [];
  for (var i = this.store.length - 1; i >= 0; i = i - 1) {
    ids[ids.length] = this.store[i][this.identifier];
  }
  return ids;
};

ArrayKeys.prototype.getRecord = function (id) {
  for (var i = this.store.length - 1; i >= 0; i = i - 1) {
    if (this.store[i][this.identifier] === id) {
      return this.store[i];
    }
  }
  return undefined;
};

ArrayKeys.prototype.exists = function (id) {
  if (this.idx.getIndex(id) >= 0) {
    return true;
  } else {
    return false;
  }
};

// faster than using indexOf
ArrayKeys.prototype.getIndex = function (id) {
  for (i = this.idx.length - 1; i >= 0; i = i - 1) {
    if (this.idx[i] === id) {
      return i;
    }
  }
  return -1;
};

ArrayKeys.prototype.addRecord = function (record) {
  if (typeof record !== 'object') {
    throw new Error('cannot add non-object records.');
  } else if (!record[this.identifier]) {
    throw new Error('cannot add a record with no `' + this.identifier +
                    '` property specified.');
  }

  this.removeRecord(record[this.identifier]);
  this.idx[this.idx.length] = record[this.identifier];
  this.store[this.store.length] = record;
  return true;
};

ArrayKeys.prototype.removeRecord = function (id) {
  var idx  = this.getIndex(id);
  if (idx < 0) {
    return false;
  }

  var i;
  // start looking for the record at the same point as the idx entry
  for (i = idx; i !== 0; i = i - 1) {
    if (this.store[i][this.identifier] === id) {
      this.store.splice(i, 1);
      this.idx.splice(idx, 1);
      return true;
    }
  }

  // if it was not found, start at the end and break at the idx number
  for (i = this.store.length - 1; i !== idx; i = i - 1) {
    if (this.store[i][this.identifier] === id) {
      this.store.splice(i, 1);
      this.idx.splice(idx, 1);
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
    for (var i = self.store.length - 1; i >= 0; i = i - 1) {
      count += 1;
      cb(self.store[i]);
    }
    finished(count);
  }, 0);

  return {
    finally: function (func) {
      finished = func;
    }
  };
};

ArrayKeys.prototype.getCount = function () {
  return this.store.length;
};

module.exports = ArrayKeys;

},{}],3:[function(_dereq_,module,exports){
'use strict';

var d        = _dereq_('d')
  , callable = _dereq_('es5-ext/object/valid-callable')

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

},{"d":4,"es5-ext/object/valid-callable":13}],4:[function(_dereq_,module,exports){
'use strict';

var assign        = _dereq_('es5-ext/object/assign')
  , normalizeOpts = _dereq_('es5-ext/object/normalize-options')
  , isCallable    = _dereq_('es5-ext/object/is-callable')
  , contains      = _dereq_('es5-ext/string/#/contains')

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

},{"es5-ext/object/assign":5,"es5-ext/object/is-callable":8,"es5-ext/object/normalize-options":12,"es5-ext/string/#/contains":15}],5:[function(_dereq_,module,exports){
'use strict';

module.exports = _dereq_('./is-implemented')()
	? Object.assign
	: _dereq_('./shim');

},{"./is-implemented":6,"./shim":7}],6:[function(_dereq_,module,exports){
'use strict';

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== 'function') return false;
	obj = { foo: 'raz' };
	assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
	return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
};

},{}],7:[function(_dereq_,module,exports){
'use strict';

var keys  = _dereq_('../keys')
  , value = _dereq_('../valid-value')

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

},{"../keys":9,"../valid-value":14}],8:[function(_dereq_,module,exports){
// Deprecated

'use strict';

module.exports = function (obj) { return typeof obj === 'function'; };

},{}],9:[function(_dereq_,module,exports){
'use strict';

module.exports = _dereq_('./is-implemented')()
	? Object.keys
	: _dereq_('./shim');

},{"./is-implemented":10,"./shim":11}],10:[function(_dereq_,module,exports){
'use strict';

module.exports = function () {
	try {
		Object.keys('primitive');
		return true;
	} catch (e) { return false; }
};

},{}],11:[function(_dereq_,module,exports){
'use strict';

var keys = Object.keys;

module.exports = function (object) {
	return keys(object == null ? object : Object(object));
};

},{}],12:[function(_dereq_,module,exports){
'use strict';

var assign = _dereq_('./assign')

  , forEach = Array.prototype.forEach
  , create = Object.create, getPrototypeOf = Object.getPrototypeOf

  , process;

process = function (src, obj) {
	var proto = getPrototypeOf(src);
	return assign(proto ? process(proto, obj) : obj, src);
};

module.exports = function (options/*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (options == null) return;
		process(Object(options), result);
	});
	return result;
};

},{"./assign":5}],13:[function(_dereq_,module,exports){
'use strict';

module.exports = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],14:[function(_dereq_,module,exports){
'use strict';

module.exports = function (value) {
	if (value == null) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{}],15:[function(_dereq_,module,exports){
'use strict';

module.exports = _dereq_('./is-implemented')()
	? String.prototype.contains
	: _dereq_('./shim');

},{"./is-implemented":16,"./shim":17}],16:[function(_dereq_,module,exports){
'use strict';

var str = 'razdwatrzy';

module.exports = function () {
	if (typeof str.contains !== 'function') return false;
	return ((str.contains('dwa') === true) && (str.contains('foo') === false));
};

},{}],17:[function(_dereq_,module,exports){
'use strict';

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}]},{},[1])
(1)
});