var WebSocketServer = require('websocket').server;
var fs = require('fs');
var node_static = require('node-static');
var config = require('./config.js').config;

var h;
var serverCfg = {};


// static files server
var static_directory = new node_static.Server('./html');


// http listeners
function listeners(req, res) {
  console.log(' [http] connect - ' + req.url);

  //req.addListener('request', function(req, res) {
  //  console.log('[http] request - ' + req.url);
  //  static_directory.serve(req, res);
  //});
  req.addListener('upgrade', function(req,res){
    console.log(' [http] upgrade - ' + req.url);
    res.end();
  });

  req.addListener('end', function () {
    console.log(' [http] end - ' + req.url);
    static_directory.serve(req, res);
  });
}


// initiallize http or https server
if (config.ENABLE_TLS) {
  h = require('https');
  serverCfg = {
    key: fs.readFileSync(config.TLS_DIR + '/tls.key'),
    cert: fs.readFileSync(config.TLS_DIR + '/tls.cert'),
    ca: fs.readFileSync(config.TLS_DIR + '/ca.pem')
  };
  var server = h.createServer(serverCfg, listeners);
} else {
  h = require('http');
  var server = h.createServer(listeners);
}


// start http server
server.listen(config.PORT, function () {
  console.log(' [http] server is listening on port ' + config.PORT);
});


// initialize websocket server
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
    if (config.PROTOCOLS.indexOf(req.requestedProtocols[i]) > -1) {
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

  var protoHandler = require('./lib/protocols/handler.js');

  protoHandler.init(protoName, connection);

  connection.on('close', function (reasonCode, description) {
    console.log(' [ws] server:  ' + (new Date()) + ' peer ' + connection.remoteAddress + ' disconnected.');
  });
});

//wsServer.on('connection', function(conn) {
//  conn.on('data', function(message) {
//    conn.write(message);
//  });
//});

console.log(' [*] finished loading' );