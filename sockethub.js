module.exports = (function() {
  var config = require('./config.js').config;

  var listener, l;
  if (config.HOST.MY_PLATFORMS.length > 0) {
    listener = require('./lib/protocols/sockethub/listener');
  }
  for (var i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
    //console.log('initializing listener for '+config.HOST.MY_PLATFORMS[i]);
    l  = Object.create(listener);
    l.init(config.HOST.MY_PLATFORMS[i]);
  }

  if (config.HOST.DISPATCHER) {
    var dispatcher;
    try {
      dispatcher = require('./lib/protocols/sockethub/dispatcher.js');
      dispatcher.init();
    } catch (e) {
      throw 'unable to load protocols/sockethub/dispatcher.js : '+e;
    }

    setTimeout(function dispatcherStatus() {
      if (dispatcher.readyState === false) {
        throw "dispatcher failed initialization";
      } else if (dispatcher.readyState === undefined) {
        dispatcherStatus();
      } else {
        var server = require('./lib/httpServer').init(config);

        // initialize websocket server
        var wsServer = require('./lib/wsServer').init(config, server, dispatcher);

        console.log(' [*] finished loading' );
      }
    }, 4000);
  }

}());