/*!
 * activity-streams
 *   version 0.2.0
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


var EventEmitter = require('wolfy87-eventemitter');
var ArrayKeys    = require('array-keys');

var streams = new ArrayKeys({ identifier: 'id' }),
    objs    = new ArrayKeys({ identifier: 'id' });
    ee      = new EventEmitter();

var Stream = {
  create: function (obj) {
    var result = false;
    try {
      result = streams.addRecord(obj);
    } catch (e) {
      throw new Error(e);
    }

    if (result) {
      ee.emitEvent('activity-stream-create', obj);
    }
    return result;
  },

  delete: function (id) {
    var result = streams.removeRecord(id);
    if (result) {
      ee.emitEvent('activity-stream-delete', id);
    }
    return result;
  },

  get: function (id) {
    return streams.getRecord(id);
  }
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
      ee.emitEvent('activity-object-create', obj);
    }
    return result;
  },

  delete: function (id) {
    var result = objs.removeRecord(id);
    if (result) {
      ee.emitEvent('activity-object-delete', id);
    }
    return result;
  },

  get: function (obj) {
    return objs.getRecord(obj);
  }
};


module.exports = {
  Stream: Stream,
  Object: _Object,
  on: ee.on,
  once: ee.once,
  off: ee.off
};
