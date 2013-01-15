module.exports = (function() {
  var config = require('./config.js').config;

  if (config.HOST.DISPATCHER) {
    var server = require('./lib/httpServer').init(config);

    // initialize websocket server
    var wsServer = require('./lib/wsServer').init(config, server);
  }

  for (var i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
    console.log('... should load listener for '+config.HOST.MY_PLATFORMS[i]);
  }

  console.log(' [*] finished loading' );
}());