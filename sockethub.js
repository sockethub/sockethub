module.exports = (function() {
  var config = require('./config.js').config;

  var server = require('./lib/httpServer').init(config);

  // initialize websocket server
  var wsServer = require('./lib/wsServer').init(config, server);

  console.log(' [*] finished loading' );
}());