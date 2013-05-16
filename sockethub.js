require("consoleplusplus/console++");
module.exports = (function() {
  var cluster = require('cluster');

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
  var i = 0;

  var _console = {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
    log: console.log
  };


  if (cluster.isMaster) {
    /** MASTER **/

    var shuttingDown = false;

    if (typeof(config.NUM_WORKERS) === 'undefined') {
      // have 2 workers by default, so when one dies clients can reconnect
      // immediately without waiting for the new worker to boot up.
      config.NUM_WORKERS = 2;
    }

    for (i = 0; i < config.NUM_WORKERS; i++) {
      cluster.fork();
    }

    cluster.on('disconnect', function (worker) {
      if (shuttingDown) {
        console.log("Worker " + worker.id + " done.");
      } else {
        console.error("Worker " + worker.id + " disconnected, spawning new one.");
        cluster.fork();
      }
    });

    process.on('SIGINT', function () {
      console.debug("\nCaught SIGINT (Ctrl+C)");
      console.info("Sockethub is shutting down...");

      shuttingDown = true;

      for (var id in cluster.workers) {
        console.info("Sending 'shutdown' message to worker " + id);
        cluster.workers[id].send('shutdown');
      }
    });

  } else {
    /** WORKER **/


    // wrap the console functions to prepend worker id
    console.info = function (msg) {
      _console.info.apply(this, ['[worker #'+cluster.worker.id+'] '+msg]);
    };
    console.error = function (msg) {
      _console.error.apply(this, ['[worker #'+cluster.worker.id+'] '+msg]);
    };
    console.debug = function (msg) {
      _console.debug.apply(this, ['[worker #'+cluster.worker.id+'] '+msg]);
    };
    console.warn = function (msg) {
      _console.warn.apply(this, ['[worker #'+cluster.worker.id+'] '+msg]);
    };
    console.log = function (msg) {
      _console.log.apply(this, ['[worker #'+cluster.worker.id+'] '+msg]);
    };

    process.on('SIGINT', function() {
      // ignore SIGINT in worker processes.
      // instead the master handles it and sends us a 'shutdown' message.
    });

    cluster.worker.on('message', function (message) {
      if (message === 'shutdown') {
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
      } else {
        console.error("Huh? Someone sent an unexpected message to this worker process: " + message);
      }
    });

    if (config.HOST.MY_PLATFORMS.length > 0) {
      listener = require('./lib/protocols/sockethub/listener');
    }
    for (i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
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

  }

}());