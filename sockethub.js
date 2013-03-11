require("consoleplusplus/console++");
module.exports = (function() {
  var config = require('./config.js').config;

  var listener;
  var initDispatcher = false;
  var dispatcher;
  var sockethubId = Math.floor((Math.random()*10)+1) + new Date().getTime();

  // test redis service
  var redis = require('redis');
  var client;
  try {
    client = redis.createClient();
  } catch (e) {
    console.error(' [sockethub] cannot connect to redis ' + e);
    process.exit();
  }
  client.quit();
  client = '';
  redis = '';


  if (config.HOST.MY_PLATFORMS.length > 0) {
    listener = require('./lib/protocols/sockethub/listener');
  }
  for (var i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
    if (config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
      initDispatcher = true;
      continue;
    }
    console.debug(' [bootstrap] initializing listener for '+config.HOST.MY_PLATFORMS[i]);
    var l  = listener();
    l.init(config.HOST.MY_PLATFORMS[i], sockethubId);
  }

  if (initDispatcher) {
    try {
      dispatcher = require('./lib/protocols/sockethub/dispatcher.js');
    } catch (e) {
      throw 'unable to load ../protocols/sockethub/dispatcher.js : ' + e;
    }

    dispatcher.init(config.HOST.MY_PLATFORMS, sockethubId).then(function () {
        // initialize http server
        var server = require('./lib/httpServer').init(config);
        // initialize websocket server
        var wsServer = require('./lib/wsServer').init(config, server, dispatcher);
        console.info(' [*] finished loading' );
        console.log("\n");
    }, function (err) {
        console.error(" [sockethub] dispatcher failed initialization, aborting");
        process.exit();
    });
  } else {
    console.info(' [sockethub] finished loading listeners. ready to work boss!');
  }



  process.on('SIGINT', function() {
    console.debug("\nCaught SIGINT (Ctrl+C)");
    console.info("Sockethub is shutting down...");

    console.info("Cleaning up listener sessions...");
    dispatcher.shutdown().then(function () {
      console.log("Exiting...");
      console.log("\n");
      process.exit();
    }, function (err) {
      console.log('Aborting...'+err);
      console.log("\n");
      process.exit();
      //throw 'shutdown error '+err;
    });
  });

}());