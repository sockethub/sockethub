/*!
 * activity-streams
 *   version 0.4.0
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


var EventEmitter = require('event-emitter'),
    ArrayKeys    = require('array-keys');

var objs        = new ArrayKeys({ identifier: 'id' }),
    ee          = EventEmitter(),
    expandProps = [ 'actor', 'object', 'target' ];

var Stream = function (meta) {
  var stream = {};
  var i;

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

  // only expand string into objects if they are in the expandProps list
  for (i = expandProps.length - 1; i >= 0; i -= 1) {
    if (typeof stream[expandProps[i]] === 'string') {
      stream[expandProps[i]] = { id: stream[expandProps[i]] };
    }
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

  get: function (id) {
    var r = objs.getRecord(id);
    if (r) {
      return r;
    } else {
      return id;
    }
  },

  list: function () {
    return objs.getIdentifiers();
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
