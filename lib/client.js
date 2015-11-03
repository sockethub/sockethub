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
