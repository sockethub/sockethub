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


var EventEmitter = require('event-emitter'),
    ArrayKeys    = require('array-keys');

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
