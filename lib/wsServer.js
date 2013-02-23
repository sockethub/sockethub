var WebSocketServer = require('websocket').server;
var ws;
var httpServer;
var wsServer = {
  init: function (config, server, dispatcher) {
    ws = new WebSocketServer({
      httpServer: server,
      // You should not use autoAcceptConnections for production
      // applications, as it defeats all standard cross-origin protection
      // facilities built into the protocol and the browser.  You should
      // *always* verify the connection's origin and decide whether or not
      // to accept it.
      autoAcceptConnections: false
    });

    httpServer = server;
    // websocket listeners
    ws.on('request', function(req) {
      //console.log(req);
      config.HOST.PROTOCOLS = [];
      config.HOST.PROTOCOLS.push('sockethub'); // we just hard-code this for now

      var protoName = false;
      var reqProtoLen = req.requestedProtocols.length;
      for (var i = 0; i < reqProtoLen; i = i + 1) {
        if (config.HOST.PROTOCOLS.indexOf(req.requestedProtocols[i]) > -1) {
          protoName = req.requestedProtocols[i];
          break;
        }
      }

      if (!protoName) {
        console.warn(' [ws] server: no valid protocols requested');
        return false;
      }

      var connection = req.accept(protoName, req.origin);
      console.info(' [ws] server: connection accepted [protocol: '+protoName+']');

      dispatcher.connect(connection);

      connection.on('close', function (reasonCode, description) {
        console.info(' [ws] server:  ' + (new Date()) + ' peer ' + connection.remoteAddress + ' disconnected.');
      });
    });
  }
};
module.exports = wsServer;
