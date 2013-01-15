module.exports = {
  init: function(config, server) {
    var WebSocketServer = require('websocket').server;
    var wsServer = new WebSocketServer({
      httpServer: server,
      // You should not use autoAcceptConnections for production
      // applications, as it defeats all standard cross-origin protection
      // facilities built into the protocol and the browser.  You should
      // *always* verify the connection's origin and decide whether or not
      // to accept it.
      autoAcceptConnections: false
    });


    // websocket listeners
    wsServer.on('request', function(req) {
      //console.log(req);

      var protoName = false;
      var reqProtoLen = req.requestedProtocols.length;
      for (var i = 0; i < reqProtoLen; i = i + 1) {
        if (config.HOST.PROTOCOLS.indexOf(req.requestedProtocols[i]) > -1) {
          protoName = req.requestedProtocols[i];
          break;
        }
      }

      if (!protoName) {
        console.log(' [ws] server: no valid protocols requested');
        return false;
      }

      var connection = req.accept(protoName, req.origin);
      console.log(' [ws] server: connection accepted [proto: '+protoName+']');

      var protoHandler = require('./protocols/handler.js');

      protoHandler.init(protoName, connection);

      connection.on('close', function (reasonCode, description) {
        console.log(' [ws] server:  ' + (new Date()) + ' peer ' + connection.remoteAddress + ' disconnected.');
      });
    });
    return wsServer;
  }
};