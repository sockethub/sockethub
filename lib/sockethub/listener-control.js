#!/usr/bin/env node

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

require("consoleplusplus/console++");
var cluster = require('cluster');
var util = require('./util.js');
var listener;
var initDispatcher = false;
var dispatcher;
var config = require('./../../config.js').config;

var sockethubId;
if (process.argv[2]) {
  sockethubId = process.argv[2];
} else {
  throw new util.SockethubError(' [listener-control] unable to get sockethubId from argument list');
}
//console.debug(' [listener-control] sockethubId: ' + sockethubId);

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
  console = require('./logging.js')({controller: 'listener',
                                     id: cluster.worker.id,
                                     console: console,
                                     debug: config.DEBUG});

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
    console.info(' [listener-control] ending listener worker session.');
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
    proto = require("./protocol.js");
  } catch (e) {
    throw new util.SockethubError(' [listener-control] unable to load lib/sockethub/protocol.js ' + e, true);
  }

  // initialize listeners
  if (config.HOST.MY_PLATFORMS.length > 0) {
    listener = require('./listener');
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
    console.log('WORKER message: ',message);
    if (message === 'shutdown') {
      console.info(' [listener-control] ending listener worker session.');
      for (var i = 0, len = listeners.length; i < len; i = i + 1) {
        listeners[i].shutdown();
      }
    } else {
      console.error(" [listener-control] huh? someone sent an unexpected message to this worker process: " + message);
    }
  });
}
