(function (global, factory, undefined) {

  if ( typeof module === 'object' && typeof module.exports === 'object' ) {
    var ActivityStreams = require('activity-streams');
    module.exports = (global.document) ? factory(global, Activity) : factory({}, ActivityStreams);
  } else {
    if (! global.ActivityStreams) {
      throw new Error('sockethub-client.js depends on the activity-streams module.');
    }
    factory(global, global.ActivityStreams);
  }

}((typeof window !== 'undefined') ? window : this, function (scope, AcitivityStreams, undefined) {

  function SockethubClient(socket) {
    this.socket          = socket;
    this.ActivityStreams = new ActivityStreams({ specialObjs: [ 'credentials' ] });

    this.socket._emit = this.socket.emit;
    this.socket.emit = function (channel, content) {
      if (typeof channel === 'string') {
        this.socket._emit(channel, content);
      } else {
        throw new Error('emit function requires a channel name [string] to be specified as the first parameter.');
      }
    }.bind(this);

    // wrapping the on method in order to automatically unpack Activity Streams objects
    // that come in on the 'messages' channel, so that app developers don't need to.
    var handlers = {
      message: function () {},
      completed: function () {},
      failure: function () {}
    };

    var self = this;
    function unpackAndCallHandler(event) {
      return function (obj) {
        var unpackedObject = self.ActivityStreams.Stream(obj);
        handlers[event](unpackedObject);
      };
    }

    // do our middle-ware stuff then call the stored handler
    socket.on('message', unpackAndCallHandler('message'));
    socket.on('completed', unpackAndCallHandler('completed'));
    socket.on('failure', unpackAndCallHandler('failure'));

    this.socket._on = socket.on;

    this.socket.on = function (event, cb) {
      if (Object.keys(handlers).includes(event)) {
        // store the desired message channel callback, because we use our own first
        handlers[event] = cb;
      } else {
        // pass on any other handlers
        this.socket._on(event, cb);
      }
    }.bind(this);
    ///

    this.ActivityStreams.on('activity-object-create', function (obj) {
      socket.emit('activity-object', obj);
    });

    socket.on('activity-object', function (obj) {
      this.ActivityStreams.Object.create(obj);
    }.bind(this));
  }

  if ( typeof define === 'function' && define.amd ) {
    define([], function() {
      return SockethubClient;
    });
  }

  scope.SockethubClient = SockethubClient;
  return SockethubClient;
}));
