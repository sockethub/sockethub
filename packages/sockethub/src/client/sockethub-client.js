(function (global, factory) {

  if ( typeof module === 'object' && typeof module.exports === 'object' ) {
    let ASFactory = require('activity-streams');
    module.exports = (global.document) ? factory(global, ASFactory) : factory({}, ASFactory);
  } else {
    // @ts-ignore
    if (! global.ASFactory) {
      throw new Error('sockethub-client.js depends on the activity-streams module.');
    }
    // @ts-ignore
    factory(global, global.ASFactory);
  }

}((typeof window !== 'undefined') ? window : this, function (scope, ASFactory) {

  function SockethubClient(socket) {
    this.socket = socket;
    this.ActivityStreams = ASFactory({specialObjs: ['credentials']});
    this.online = false;
    this.debug = false;

    this.__registerSocketIOHandlers();

    this.ActivityStreams.on('activity-object-create', (obj) => {
      socket.emit('activity-object', obj);
    });

    socket.on('activity-object', (obj) => {
      this.ActivityStreams.Object.create(obj);
    });
  }

  SockethubClient.prototype.log = function (msg, obj) {
    if (this.debug) {
      console.log(msg, obj);
    }
  };

  SockethubClient.prototype.__handlers = {
    // wrapping the `on` method in order to automatically unpack Activity Streams objects
    // that come in on the 'messages' channel, so that app developers don't need to.
    message: [],
    completed: [],
    failed: [],
    reconnecting: [],
    reconnect_failed: [],
    connect: [],
    reconnect: [],
    disconnect: []
  };

  SockethubClient.prototype.__registerSocketIOHandlers = function () {
    let storedCredentials     = new Map(),
        storedActivityObjects = new Map(),
        storedConnects        = new Map(),
        storedJoins           = new Map();

    // middleware for events which don't deal in AS objects
    const callHandler = (event) => {
      return (obj) => {
        if (event === 'reconnect') {
          this.online = true;
          this.__replay('activity-object', storedActivityObjects);
          this.__replay('credentials', storedCredentials);
          this.__replay('message', storedConnects);
          this.__replay('message', storedJoins);
        } else if (event === 'connect') {
          this.online = true;
        } else if (event === 'disconnect') {
          this.online = false;
        }
        for (let cb of this.__handlers[event]) {
          cb(obj);
        }
      };
    };

    // register for events that give us information on connection status
    this.socket.on('reconnecting', callHandler('reconnecting'));
    this.socket.on('reconnect_failed', callHandler('reconnect_failed'));
    this.socket.on('connect', callHandler('connect'));
    this.socket.on('reconnect', callHandler('reconnect'));
    this.socket.on('disconnect', callHandler('disconnect'));

    // do our middle-ware stuff then call the stored handler
    this.socket.on('message', this.__unpackAndCallHandler('message'));
    this.socket.on('completed', this.__unpackAndCallHandler('completed'));
    this.socket.on('failed', this.__unpackAndCallHandler('failed'));

    // we over-ride socketIO's emit method in order to catch credentials, activity-objects,
    // and joins, and store them for replay if we connect.
    // joins are only stored until confirmation is received that it was sent, then we remove it
    // from the map.
    this.socket._emit = this.socket.emit;
    this.socket.emit = (channel, content) => {
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
          if (this.online) {
            // either store or delete the specified content onto the storedJoins map,
            // for reply once we're back online.
            if (content['@type'] === 'join') {
              storedJoins['set'](this.__getKey(content), content);
            } else if (content['@type'] === 'leave') {
              storedJoins['delete'](this.__getKey(content), content);
            } if (content['@type'] === 'connect') {
              storedConnects['set'](this.__getKey(content), content);
            } else if (content['@type'] === 'disconnect') {
              storedConnects['delete'](this.__getKey(content), content);
            }
          } else {
            // reject message if we're not online
            this.socket._emit('failed', content);
          }
          break;
      }
      this.socket._emit(channel, content);
    };

    this.socket._on = this.socket.on;
    this.socket.on = (event, cb) => {
      if (Object.keys(this.__handlers).includes(event)) {
        // store the desired message channel callback, because we use our own first
        this.__handlers[event].push(cb);
      } else {
        // pass on any other handlers
        this.socket._on(event, cb);
      }
    };
  };

  SockethubClient.prototype.__replay = function (name, asMap) {
    asMap.forEach((obj) => {
      this.log(`replaying ${name}`, obj);
      this.socket._emit(name, obj);
    });
  };

  // use as a middleware to receive incoming Sockethub messages and unpack them
  // using the ActivityStreams library before passing them along to the app.
  SockethubClient.prototype.__unpackAndCallHandler = function (event) {
    return (obj) => {
      let unpackedObject = this.ActivityStreams.Stream(obj);
      for (let cb of this.__handlers[event]) {
        cb(unpackedObject);
      }
    };
  };

  SockethubClient.prototype.__getKey = function (content) {
    let actor = content.actor['@id'] || content.actor;
    let target = content.target ? content.target['@id'] || content.target : '';
    return actor + '-' + target;
  };

  if ( typeof define === 'function' && define.amd ) {
    define([], function () {
      return SockethubClient;
    });
  }

  scope.SockethubClient = SockethubClient;
  return SockethubClient;
}));
