/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

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
      autoAcceptConnections: false,
      // Firefox 7 alpha has a bug that drops the
      // connection on large fragmented messages
      fragmentOutgoingMessages: false
    });

    httpServer = server;
    // websocket listeners
    ws.on('request', function(req) {
      //console.log(req);
      //config.HOST.PROTOCOLS = [];
      //config.HOST.PROTOCOLS.push('sockethub');
      // we just hard-code this for now we currently don't accept any protocols
      // other than sockethub, so simplifying this section try to address race
      // conditions in setting up message listeners
      /*for (var i = 0, len = req.requestedProtocols.length; i < len; i = i + 1) {
        if (config.HOST.PROTOCOLS.indexOf(req.requestedProtocols[i]) > -1) {
          protoName = req.requestedProtocols[i];
          break;
        }
      }*/
      var protoName = false;
      if ((typeof req.requestedProtocols.indexOf !== 'undefined') &&
          (req.requestedProtocols.indexOf('sockethub') > -1)) {
        protoName = 'sockethub';
      } else {
        console.warn(' [ws] server: no valid protocols requested');
        return false;
      }

      var connection = req.accept(protoName, req.origin);
      console.info(' [ws] server: connection accepted [protocol: ' + protoName + ']');

      dispatcher.connect(connection);

      connection.on('close', function (reasonCode, description) {
        console.info(' [ws] server:  ' + (new Date()) + ' peer ' + connection.remoteAddress + ' disconnected.');
      });
    });
  }
};
module.exports = wsServer;
