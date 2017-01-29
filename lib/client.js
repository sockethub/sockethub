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

    socket.on('activity-object', function (obj) {
      console.log('received activity-streams object from sockethub server: ', obj);
      this.ActivityStreams.Object.create(obj);
    }.bind(this));

    this.ActivityStreams.on('activity-object-create', function (obj) {
      socket.emit('activity-object', obj);
    });
  }

  if ( typeof define === 'function' && define.amd ) {
    define([], function() {
      return SockethubClient;
    });
  }

  scope.SockethubClient = SockethubClient;
  return SockethubClient;
}));
