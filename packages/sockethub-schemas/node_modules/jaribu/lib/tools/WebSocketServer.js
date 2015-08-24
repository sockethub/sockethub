/**
 * Function: WebSocketServer
 *
 * The WebSocketServer object is used to create a very basic WebSocket Server,
 * used mainly for assisting jaribu in verifying the functionality of the
 * WebSocket client tool, tested in the websocket-suite.js
 *
 *      env.expected = { // struct of expected results for each websocket call
 *         test: {
 *            foo: "bar"
 *          }
 *      };
 *
 *      env.server = new this.WebSocketServer({
 *          port: 9992,
 *          uris: env.expected
 *      });
 *      this.assertAnd(env.server.run(), true);
 *
 * Parameters:
 *
 *   object conatining the properties:
 *       port - port to run on
 *
 *       uris - an object where the first set of properties are URIs the values
 *              attached to them are the data sets to return.
 *
 * Returns:
 *
 *   returns output from the function passed as parameter
 */
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['jaribu/tools/Write'], function (Write, undefined) {
  var writeObj = new Write();
  var write = writeObj.func;

  var WebSocketServer = function (cfg) {
    if (typeof cfg.port === 'number') {
      this.port = cfg.port;
    }
    if (typeof cfg.messages === 'object') {
      this.messages = cfg.messages;
    }
    if (typeof cfg.uri === 'string') {
      this.uris = cfg.uris;
    }
  };

  WebSocketServer.prototype = {
    port: 9992,
    uri: '/',
    messages: {},
    http: undefined
  };

  WebSocketServer.prototype.run = function (callback) {
    var WebSocketServer = require('websocket').server;
    var http = requirejs('http');
    var messages = this.messages;
    var port = this.port;

    var server = http.createServer(function (request, response) {
      write('[WebSocketServer]: ' + (new Date()) + ' Received request for ' + request.url);
      response.writeHead(404);
      response.end();
    });

    server.listen(port, function () {
      write('[WebSocketServer]: ' + (new Date()) + ' Server is listening on port ' + port);
      callback();
    });

    wsServer = new WebSocketServer({
      httpServer: server,
      // You should not use autoAcceptConnections for production
      // applications, as it defeats all standard cross-origin protection
      // facilities built into the protocol and the browser.  You should
      // *always* verify the connection's origin and decide whether or not
      // to accept it.
      autoAcceptConnections: false
    });

    wsServer.on('request', function (request) {
      var connection = request.accept('echo-protocol', request.origin);
      write('[WebSocketServer]: ' + (new Date()) + ' Connection accepted.');

      connection.on('message', function (message) {
        var key;
        var messageFound = false;
        if (message.type === 'utf8') {
          write('[WebSocketServer]: Received Message: ' + message.utf8Data);

          for (key in messages) {
            if (message.utf8Data === key) {
              messageFound = true;
              connection.sendUTF(JSON.stringify(messages[key]));
            }
          }

          if (!messageFound) {
            connection.sendUTF('{"error":"command not found in messages data struct."}');
          }
        } else if (message.type === 'binary') {
          write('[WebSocketServer]: Received Binary Message of ' + message.binaryData.length + ' bytes');
          connection.sendBytes(message.binaryData);
        }
        //console.log('server: ',message);
      });
      connection.on('close', function (reasonCode, description) {
        write('[WebSocketServer]: ' + (new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
      });
    });
  };

  WebSocketServer.prototype.stop = function () {};

  return WebSocketServer;
});