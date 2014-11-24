/*!
 * activity-streams
 *   version 0.1.2
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

(function (global, factory, undefined) {

  if ( typeof module === 'object' && typeof module.exports === 'object' ) {
    var ArrayKeys = require('array-keys');
    var EventEmitter = require('wolfy87-eventemitter');
    module.exports = (global.document) ? factory(global, ArrayKeys, EventEmitter) :
                                         factory({}, ArrayKeys, EventEmitter);
  } else {
    if (! global.ArrayKeys) {
      throw new Error('activity-streams.js depends on the ArrayKeys module.');
    } else if (! global.EventEmitter) {
      throw new Error('activity-streams.js depends on the EventEmitter module.');
    }
    factory(global, global.ArrayKeys, global.EventEmitter);
  }

}((typeof window !== 'undefined') ? window : this, function (scope, ArrayKeys, EventEmitter, undefined) {
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
    },

    delete: function (id) {
      var result = streams.removeRecord(id);
      if (result) {
        ee.emitEvent('activity-stream-delete', id);
      }
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
    },

    delete: function (id) {
      var result = objs.removeRecord(id);
      if (result) {
        ee.emitEvent('activity-object-delete', id);
      }
    },

    get: function (obj) {
      return objs.getRecord(obj);
    }
  };


  if ( typeof define === 'function' && define.amd ) {
    define([], function() {
      return Activity;
    });
  }

  scope.Activity = {
    Stream: Stream,
    Object: _Object,
    on: ee.on,
    once: ee.once,
    off: ee.off
  };

  return scope.Activity;
}));

