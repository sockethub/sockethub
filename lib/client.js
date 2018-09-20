(function (global, factory, undefined) {

  if ( typeof module === 'object' && typeof module.exports === 'object' ) {
    let ActivityStreams = require('activity-streams');
    module.exports = (global.document) ? factory(global, Activity) : factory({}, ActivityStreams);
  } else {
    if (! global.ActivityStreams) {
      throw new Error('sockethub-client.js depends on the activity-streams module.');
    }
    factory(global, global.ActivityStreams);
  }

}((typeof window !== 'undefined') ? window : this, function (scope, AcitivityStreams, undefined) {

  function SockethubClient(socket) {
    let storedCredentials = new Map();
    let storedActivityObjects = new Map();
    let storedJoins = new Map();
    let online = false;
    let self = this;

    // wrapping the `on` method in order to automatically unpack Activity Streams objects
    // that come in on the 'messages' channel, so that app developers don't need to.
    let handlers = {
      message: function (msg) {
        console.warn(`message event received with no handler registered: `, msg);
      },
      completed: function (msg) {
        console.warn('completed event received with no handler registered: ', msg);
      },
      failed: function (msg) {
        console.warn('failed event received with no handler registered: ', msg);
      },
      reconnecting: function (msg) {
        console.warn('reconnecting: ', msg);
      },
      reconnect_failed: function (msg) {
        console.warn('reconnect failed: ', msg);
      },
      connect: function () {
        console.warn('connected.');
      },
      reconnect: function (msg) {
        console.warn('reconnected: ', msg);
      },
      disconnect: function (msg) {
        console.warn('disconnected: ', msg);
      }
    };

    this.ActivityStreams = new ActivityStreams({ specialObjs: [ 'credentials' ] });
    this.socket = socket;

    // register for events that give us information on connection status
    socket.on('reconnecting', callHandler('reconnecting'));
    socket.on('reconnect_failed', callHandler('reconnect_failed'));
    socket.on('connect', callHandler('connect'));
    socket.on('reconnect', callHandler('reconnect'));
    socket.on('disconnect', callHandler('disconnect'));

    // do our middle-ware stuff then call the stored handler
    socket.on('message', unpackAndCallHandler('message'));
    socket.on('completed', unpackAndCallHandler('completed'));
    socket.on('failed', unpackAndCallHandler('failed'));

    this.socket._emit = this.socket.emit;
    this.socket.emit = function (channel, content) {
      if (typeof channel !== 'string') {
        throw new Error('emit function requires a channel name [string] to be specified as the'
                        + ' first parameter.');
      }
      switch (channel) {
        case 'credentials':
          if ((content.object) && (content.object['@type'] === 'credentials')) {
            storedCredentials.set(content.actor['@id'] || content.actor, content);
          }
          break;
        case 'activity-object':
          if (content['@id']) {
            storedActivityObjects.set(content['@id'], content);
          }
          break;
        case 'message':
          if (online) {
            if (content['@type'] === 'join') {
              updateJoins('set', content);
            } else if (content['@type'] === 'leave') {
              updateJoins('delete', content);
            }
          } else {
            // reject message if we're not online
            socket._emit('failed', content);
          }
          break;
      }
      self.socket._emit(channel, content);
    };

    this.socket._on = socket.on;
    this.socket.on = function (event, cb) {
      if (Object.keys(handlers).includes(event)) {
        // store the desired message channel callback, because we use our own first
        handlers[event] = cb;
      } else {
        // pass on any other handlers
        self.socket._on(event, cb);
      }
    };

    // use as a middleware to receive incoming Sockethub messages and unpack them
    // using the ActivityStreams library before passing them along to the app.
    function unpackAndCallHandler(event) {
      return function (obj) {
        let unpackedObject = self.ActivityStreams.Stream(obj);
        handlers[event](unpackedObject);
      };
    }

    // middleware for events which don't deal in AS objects
    function callHandler(event) {
      return function (obj) {
        if (event === 'reconnect') {
          online = true;
          replayActivityObjects();
          replayCredentials();
          replayJoins();
        } else if (event === 'connect') {
          online = true;
        } else if (event === 'disconnect') {
          online = false;
        }
        handlers[event](obj);
      };
    }

    function replayActivityObjects() {
      storedActivityObjects.forEach(function (obj, key) {
        socket._emit('activity-object', obj);
      });
    }

    function replayCredentials() {
      storedCredentials.forEach(function (obj, key) {
        socket._emit('credentials', obj);
      });
    }

    function replayJoins() {
      storedJoins.forEach(function (obj, key) {
        socket._emit('message', obj);
      });
    }

    // either store or deletect the specified content onto the storedJoins map,
    // for reply once we're back online.
    function updateJoins(action, content) {
      let actor = content.actor['@id'] || content.actor;
      let target = content.target['@id'] || content.target;
      let key = actor + '-' + target;
      storedJoins[action](key, content);
    }

    this.ActivityStreams.on('activity-object-create', function (obj) {
      socket.emit('activity-object', obj);
    });

    socket.on('activity-object', function (obj) {
      self.ActivityStreams.Object.create(obj);
    });
  }

  if ( typeof define === 'function' && define.amd ) {
    define([], function () {
      return SockethubClient;
    });
  }

  scope.SockethubClient = SockethubClient;
  return SockethubClient;
}));