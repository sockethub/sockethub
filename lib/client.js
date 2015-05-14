(function (global, factory, undefined) {

  if ( typeof module === 'object' && typeof module.exports === 'object' ) {
    var Activity = require('activity-streams');
    module.exports = (global.document) ? factory(global, Activity) : factory({}, Activity);
  } else {
    if (! global.Activity) {
      throw new Error('sockethub-client.js depends on the activity-streams module.');
    }
    factory(global, global.Activity);
  }

}((typeof window !== 'undefined') ? window : this, function (scope, Acitivity, undefined) {

  function SockethubClient(socket) {
    this.socket   = socket;
    this.Activity = Activity;

    socket.on('activity-object', function (obj) {
      console.log('received activity-streams object from sockethub server: ', obj);
      Activity.Object.create(obj);
    });

    Activity.on('activity-object-create', function (obj) {
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
