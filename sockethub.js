require("consoleplusplus/console++");
var posix = require('posix');
module.exports = (function() {
  var cluster = require('cluster');

  var config = require('./config.js').config;
  if (!config.EXAMPLES) {
    config.EXAMPLES = {
      ENABLE: true,
      SECRET: '1234567890',
      LOCATION: './examples'
    };
  }
  if (!config.HOST) {
    config.HOST = {
      ENABLE_TLS: false,
      PORT: 10550,
      MY_PLATFORMS: config.PLATFORMS
    };
  }

  var listener;
  var initDispatcher = false;
  var dispatcher;
  var sockethubId = Math.floor((Math.random()*10)+1) + new Date().getTime();


  // set session ulimit
  var limits = posix.getrlimit('nofile');
  console.debug('CURRENT SYSTEM RESOURCE limits: soft=' + limits.soft + ', max=' + limits.hard);
  posix.setrlimit('nofile', {soft: '4096', hard: '4096'});
  limits = posix.getrlimit('nofile');
  console.debug('ADJUSTED RESOURCES limits: soft=' + limits.soft + ', max=' + limits.hard);


  // test redis service
  console.info(" [sockethub] verifying redis connection");
  (function redisCheck() {
    var redis = require('redis');
    var client;
    try {
      client = redis.createClient();
      client.on('error', function (err) {
        console.error(' [sockethub] '+err);
        process.exit();
      });
      client.on('ready', function () {
        console.info(' [sockethub] redis check successful');
        client.quit();
        initSockethub(); // initialize Sockethub!
      });
    } catch (e) {
      console.error(' [sockethub] cannot connect to redis: ' + e);
      process.exit();
    }
  })();


  function initSockethub() {
    var i = 0;

    var _console = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
      log: console.log
    };



    /**
     *  write examples/connect-config.js
     */
    var fs = require('fs');
    var fileContents;
    var TLS = false;
    var secret = '1234567890';
    if ((config.PUBLIC) &&
        (config.PUBLIC.DOMAIN) &&
        (config.PUBLIC.PORT) &&
        (config.PUBLIC.PATH)) {
      TLS = (config.PUBLIC.TLS) ? 'true' : 'false';
      fileContents = 'var CONNECT = {};' +
                     'CONNECT.TLS=' + TLS + ';' +
                     'CONNECT.HOST="' + config.PUBLIC.DOMAIN + '";' +
                     'CONNECT.PORT=' + config.PUBLIC.PORT + ';' +
                     'CONNECT.PATH="' + config.PUBLIC.PATH + '";';
    } else {
      TLS = (config.HOST.ENABLE_TLS) ? 'true' : 'false';
      fileContents = 'var CONNECT = {};' +
                     'CONNECT.TLS=' + TLS + ';' +
                     'CONNECT.HOST="localhost";' +
                     'CONNECT.PORT=' + config.HOST.PORT + ';' +
                     'CONNECT.PATH="/sockethub";';
    }
    if ((config.EXAMPLES) && (config.EXAMPLES.SECRET)) {
      secret = config.EXAMPLES.SECRET;
    }
    fileContents = fileContents + 'CONNECT.SECRET="'+secret+'";';
    fs.writeFile("examples/connect-config.js", fileContents, function (err) {
      if (err) {
        console.error(' [sockethub] failed to write to examples/connect-config.js - examples may not work');
      } else {
        console.info(' [sockethub] wrote to examples/connect-config.js');
      }
    });
    /****/



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

      cluster.on('exit', function (worker, code, signal) {
        if (worker.suicide) {
          console.log('worker exited '+code+' '+signal);
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
        listener = require('./lib/sockethub/listener');
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
          dispatcher = require('./lib/sockethub/dispatcher.js');
        } catch (e) {
          throw 'unable to load lib/sockethub/dispatcher.js : ' + e;
        }

        dispatcher.init(config.HOST.MY_PLATFORMS, sockethubId).then(function () {
          var server;
          try {
            // initialize http server
            server = require('./lib/servers/http').init(config);
          } catch (e) {
            console.error('unable to load lib/servers/http ' + e);
            worker.kill();
          }

          var wsServer;
          try {
            // initialize websocket server
            wsServer = require('./lib/servers/websocket').init(config, server, dispatcher);
          } catch (e) {
            console.error('unable to load lib/servers/websocket ' + e);
            worker.kill();
          }

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
  }
}());