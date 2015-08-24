/**
 * Function: remoteStorageMock
 *
 * a set of mock functions to mimick remoteStorage behavior from a modules
 * perspective.
 *
 * Parameters:
 *
 *   dummyData - a JSON struct of the dummy data you want to use for testing
 *
 * Returns:
 *
 *   return a remoteStorage object with sub-objects:
 *     remoteStorage.defineModule
 *     remoteStorage.baseClient
 *     remoteStorage.baseClient.use
 *     remoteStorage.baseClient.getListing
 *     remoteStorage.baseClient.getObject
 *     remoteStorage.baseClient.storeObject
 *
 *
 */
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['jaribu/fakes/Stub'], function (Stub, undefined) {
  var _ = {};
  _.data = {};
  _.schema = {};
  _.on = {};

  var remoteStorage = function (dummyData) {
    if (dummyData) {
      _.data = dummyData;
    }
  };
  var defineModule = new Stub(function (name, func) {
    var ret = [];
    ret[0] = name;
    ret[1] = func;
    return ret;
  });

  var baseClient = new Stub(function (p) {
    var args = Array.prototype.slice.call(arguments);
    return args;
  });

  baseClient.use = new Stub(function () {
      return true;
  });

  function grabPathData(path) {
    var key;
    var listing = false;
    var object = false;
    if ((path.match(/\/$/)) || (path.match(/^\s*$/))) {
      listing = true;
    } else {
      object = true;
    }

    var ret = [];
    for (key in _.data) {
      if (path === key) {
        // exact match
        return _.data[key];
      } else if (listing) {
        var reg = new RegExp("^"+path+"[a-zA-Z\\-\\_0-9]+$");
        if (reg.test(key)) {
          end_key = key.match(/[a-zA-Z\-\_0-9]+$/);
          ret.push(end_key[0]);
        }
      }
    }
    // nothing left to do, data is set
    return ret;
  }

  // getListing calls are handle by this stub
  baseClient.getListing = new Stub(function (path, callback) {
    var d = grabPathData(path);

    if (callback) {
      callback(d);
    } else {
      return d;
    }
  });

  // getObject calls are handled by this stub
  baseClient.getObject = new Stub(function (path, callback) {
    var d = grabPathData(path);

    if (d === undefined) {
      d = [];
    }

    if (callback) {
      callback(d);
    } else {
      return d;
    }
  });

  baseClient.on = function (type, callback) {
    _.on[type] = callback;
  };

  function validateObject(type, obj) {
    var key;
    if (_.schema[type]  === undefined) { return true; }
    //if (typeof obj !== _.schema[type].type) { return false; }
    for (key in _.schema[type].properties) {
      if (obj[key] === undefined ) {
        return false;
      }
      if ((obj[key] !== undefined) &&
          (typeof obj[key] !== _.schema[type].properties[key].type)) {
        return false;
      }
      if ((_.schema[type].properties[key].required) &&
          (!obj[key])) {
        return false;
      }
    }
    return true;
  }

  // storeObject calls are handled by this stub
  baseClient.storeObject = new Stub(function (type, path, new_obj, callback) {
    if (!validateObject(type, new_obj)) {
      if (typeof _.on['error'] === 'function') {
        _.on['error']('error validating object');
      }
      return false;
    }
    _.data[path] = new_obj;
    if (typeof _.on['change'] === 'function') {
      _.on['change'](new_obj);
    }
    if (callback) {
      callback();
    }
  });

  baseClient.declareType = new Stub(function (type, schema) {
    _.schema[type] = schema;
  });

  remoteStorage.prototype = {
    data: {},
    defineModule: defineModule,
    baseClient: baseClient
  };

  return remoteStorage;
});
