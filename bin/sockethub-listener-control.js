#!/usr/bin/env node
/**
 * This file is part of sockethub.
 *
 * copyright 2012-2013 Nick Jennings (https://github.com/silverbucket)
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

require("consoleplusplus/console++");
var p = require('./../package.json');
var cluster = require('cluster');
var util = require('./../lib/sockethub/util.js');
var listener;
var initDispatcher = false;
var dispatcher;
var config;

var argv = require ("argp")
    .description ("this executable is not meant to be run by the user, instead it's called from sockethub")
    .email ('https://github.com/sockethub/sockethub/issues')
    .on('end', function(argv) {
      //
      // command-line args check
      var _config;
      if (argv.config) {
        _config = argv.config;
      } else if (argv.configObject) {
        try {
          _config = JSON.parse(argv.configObject);
        } catch (e) {
          errorAndExit('unable to read config object as json');
          //throw new Error('unable to read config object as json');
        }
      } else {
        _config = '../config.js';
      }

      if (argv.sockethubid) {
        sockethubId = argv.sockethubid;
      } else {
        errorAndExit('no sockethubId specified');
      }
      config = require('./../lib/sockethub/config-loader').get(_config, [], argv);
      //
      // got config loaded, now initialize listener(s)
      listenerControl();
    })
    .body ()
        //The object an argument definitions and the text of the --help message are
        //configured at the same time
        .text ("\n Options:")
        .option ({ short: "c", long: "config", metavar: "CONFIG_FILE", description: "location of the config.js file"})
        .option ({ short: "d", long: "debug", description: "enable debug output (overrides config file)" })
        .option ({ short: "i", long: "sockethubid", metavar: "SOCKETHUB_ID", description: "assign this instance an existing sockethubId, rather than it generating it's own." })
        .option ({ short: "l", long: "log", metavar: "LOG_FILE", description: "full path for sockethub to log output" })
        .option ({ short: "o", long: "configObject", metavar: "CONFIG_OBJECT", description: "pass config as a json object"})
        .option ({ short: "v", long: "verbose", description: "outputs logs to console in addition to any logfile" })
        .help ()
        .usage ()
        .version (p.version)
    .argv ();

function errorAndExit(err) {
    console.log('sockethub-listener-control.js');
    console.log('');
    console.log("this executable is not meant to be run by the user, instead it's called from sockethub");
    console.log('');
    console.log('ERROR: '+err);
    process.exit(1);
}

function listenerControl() {
  var i = 0;
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

    /*process.on('SIGTERM', function () {
      console.log("\n [listener-control] (master) caught SIGTERM");
    });
    process.on('SIGINT', function () {
      console.log("\n [listener-control] (master) caught SIGINT");
    });*/

    cluster.on('disconnect', function (worker) {
      if (shuttingDown) {
        console.info(" [listener-control] worker " + worker.id + " done.");
      } else {
        console.error(" [listener-control] worker " + worker.id +
                      " disconnected, spawning new one.");
        cluster.fork();
      }
    });

    cluster.on('exit', function (worker, code, signal) {
      if (code === 1) {
        console.info(' [listener-control] worker exited ' + code +
                     ' ... shutting down');
        shuttingDown = true;
      }

      if (worker.suicide) {
        console.log(' [listener-control] worker exited '+code+' '+signal);
      }
    });



  } else if (cluster.isWorker) {
    /** WORKER **/

    // wrap the console functions to prepend worker id
    console = require('./../lib/sockethub/logging.js')({controller: 'listener',
                                       id: cluster.worker.id,
                                       console: console,
                                       debug: config.DEBUG,
                                       logfile: config.LOG_FILE,
                                       verbose: config.VERBOSE});

    process.on('uncaughtException', function (err) {
      console.debug(' [listener-control] caught exception: ' + err, err);
      if (err.stack) {
        console.log(err.stack);
      }
      if (err.exit) {
        process.exit(1);
      } else {
        process.exit();
      }
    });

    process.on('SIGINT', function () {
      console.debug(" [listener-control] worker: caught SIGINT (Ctrl+C)");
      console.info(' [listener-control] ending listener worker session');
      for (var i = 0, len = listeners.length; i < len; i = i + 1) {
        listeners[i].shutdown();
      }
      process.exit();
    });

    process.on('SIGTERM', function () {
      console.log("\n [listener-control] caught SIGTERM");
    });

    var proto;
    // load in protocol.js (all the schemas) and perform validation
    try {
      proto = require("./../lib/sockethub/protocol.js");
    } catch (e) {
      throw new util.SockethubError(' [listener-control] unable to load lib/sockethub/protocol.js ' + e, true);
    }

    // initialize listeners
    if (config.HOST.MY_PLATFORMS.length > 0) {
      listener = require('./../lib/sockethub/listener');
    }

    var listeners = []; // running listener instances
    for (i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
      //console.debug(' [listener-control] initializing listener for ' +
      //              config.HOST.MY_PLATFORMS[i]);
      if (config.HOST.MY_PLATFORMS[i] === 'dispatcher') { continue; }
      try {
        var l  = listener({
          platform: proto.platforms[config.HOST.MY_PLATFORMS[i]],
          sockethubId: sockethubId
        });
        listeners.push(l);
      } catch (e) {
        console.error(' [listener-control] failed initializing ' +
                      config.HOST.MY_PLATFORMS[i] + ' platform: ', e);
        process.exit(1);
      }
    }

    cluster.worker.on('message', function (message) {
      console.log('WORKER message: ', message);
      if (message === 'shutdown') {
        console.info(' [listener-control] ending listener worker session');
        for (var i = 0, len = listeners.length; i < len; i = i + 1) {
          listeners[i].shutdown();
        }
      } else {
        console.error(" [listener-control] huh? someone sent an unexpected message to this worker process: " + message);
      }
    });
  }
}
