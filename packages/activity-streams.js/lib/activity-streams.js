(function (scope, undefined) {
  var streams, objs;


  var Stream = {
    create: function (obj) {
      return streams.addRecord(obj);
    },

    delete: function (obj) {
      return streams.removeRecord(obj);
    },

    get: function (obj) {
      return streams.getRecord(obj);
    }
  };


  var _Object = {
    create: function (obj) {
      return objs.addRecord(obj);
    },

    delete: function (obj) {
      return objs.removeRecord(obj);
    },

    get: function (obj) {
      return objs.getRecord(obj);
    }
  };

  if (typeof module === 'object') {

    scope.ArrayKeys = require('array-keys');

    module.exports = {
      Stream: Stream,
      Object: _Object
    };

  } else {

    if (!scope.ArrayKeys) {
      throw new Error('activity-stream.js depends on the array-keys module.');
    }

    scope.Activity = {
      Stream: Stream,
      Object: _Object
    };

  }

  streams = new scope.ArrayKeys({ identifier: 'id' });
  objs = new scope.ArrayKeys({ identifier: 'id' });

})((typeof scope === 'object') ? scope: {});

