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

//
// This is a bootstrap file, it handles loading config, setting default values,
// initializing the dispatcher and listener(s), and doing all the dirty checking
// and setup of the correct running environment.
//
require("consoleplusplus/console++");
var util = require('./util.js');
var posix = require('posix');
var promising = require('promising');
var fs = require('fs');

var config;
var sockethubId;


function generateSockethubId() {
  var randa = Math.floor((Math.random()*10)+1) + new Date().getTime();
  var randb = Math.floor((Math.random()*10)+2) *
            Math.floor((Math.random()*10)+3) /
            Math.floor((Math.random()*10)+4);
  return randa * randb / 1000;
}

process.on('uncaughtException', function (err) {
  console.error(' [sockethub] caught exception: ' + err);
  console.log(err.stack);
  process.exit(1);
});


//
// perform config sanity checks, redis version and connectivity
//
function check() {
  var promise = promising();
  if (!config) {
    console.error(' [sockethub] nothing found in config, exiting.');
    process.exit(1);
  }

  config.PLATFORMS = config.PLATFORMS || [];
  config.NUM_WORKERS = (typeof config.NUM_WORKERS === 'number') ? config.NUM_WORKERS : 2;
  if (config.PLATFORMS.length === 0) {
    console.error(' [sockethub] no platforms defined, exiting.');
    process.exit(1);
  }

  if (!config.HOST) {
    config.HOST = {};
  }
  config.HOST.ENABLE_TLS = config.HOST.ENABLE_TLS || false;
  config.HOST.TLS_CERTS_DIR = config.HOST.TLS_CERTS_DIR || '';
  config.HOST.PORT = config.HOST.PORT || 10550;
  config.HOST.MY_PLATFORMS = config.HOST.MY_PLATFORMS || config.PLATFORMS;
  config.HOST.SETUID = config.HOST.SETUID || 99;

  if (!config.PUBLIC) {
    config.PUBLIC = {};
  }
  config.PUBLIC.DOMAIN = config.PUBLIC.DOMAIN || 'localhost';
  config.PUBLIC.PORT = config.PUBLIC.PORT || config.HOST.PORT;
  config.PUBLIC.PATH = config.PUBLIC.PATH || '/';
  config.PUBLIC.TLS = config.PUBLIC.TLS || config.HOST.ENABLE_TLS;
  config.PUBLIC.EXAMPLES_PATH = config.PUBLIC.EXAMPLES_PATH || '/examples';

  if (!config.EXAMPLES) {
    config.EXAMPLES = {};
  }
  config.EXAMPLES.ENABLE = config.EXAMPLES.ENABLE || true;
  config.EXAMPLES.SECRET = config.EXAMPLES.SECRET || '1234567890';
  config.EXAMPLES.LOCATION = config.EXAMPLES.LOCATION || './examples';


  for (var i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
    if (config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
      config.HOST.INIT_DISPATCHER = true;
    } else if ((config.NUM_WORKERS > 0) && (typeof config.HOST.INIT_LISTENER === 'undefined')) {
      config.HOST.INIT_LISTENER = true; // we are responsible for at least
                                        // one listener
    }
  }

  if (typeof config.HOST.INIT_LISTENER === 'undefined') {
    config.HOST.INIT_LISTENER = false;
  }

  // set session ulimit
  var limits = posix.getrlimit('nofile');
  console.debug('CURRENT SYSTEM RESOURCE limits: soft=' + limits.soft + ', max=' + limits.hard);
  try {
    posix.setrlimit('nofile', {soft: '4096', hard: '4096'});
    limits = posix.getrlimit('nofile');
    console.debug('ADJUSTED RESOURCES limits: soft=' + limits.soft + ', max=' + limits.hard);
  } catch (e) {
    console.error('unable to set ulimit, resource issues could arise. skipping');
  }

  // test redis service
  console.info(" [sockethub] verifying redis connection");
  util.redis.check(function (err) {
    if (err) {
      console.error(' [sockethub] REDIS ERROR: '+err);
      promise.reject();
      process.exit();
    } else {
      console.info(' [sockethub] redis check successful');
      promise.fulfill(config);
    }
  });
  return promise;
}


// prep the examples config.js
function prep(config, root) {
  var promise = promising();
  /**
   *  write examples/connect-config.js
   */
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
  //console.debug('PATH: '+root+"/examples/connect-config.js");
  fs.writeFile(root+"/examples/connect-config.js", fileContents, function (err) {
    if (err) {
      console.error(' [sockethub] failed to write to examples/connect-config.js - examples may not work');
      promise.reject('failed to write to examples/connect-config.js');
    } else {
      console.info(' [sockethub] wrote to examples/connect-config.js');
      promise.fulfill(config);
    }
  });
  return promise;
}


function shutdownDispatcher(dispatcher) {
  var promise = promising();
  if (!dispatcher) {
    promise.fulfill(null);
    return promise;
  }
  console.info(' [sockethub] shutting down dispatcher');
  dispatcher.shutdown().then(function () {
    console.info(" [sockethub] exiting...");
    //console.log("\n");
    util.redis.clean(sockethubId, function (err) {
      promise.fulfill();
    });
  }, function (err) {
    console.error(' [sockethub] '+err);
    console.log("\n");
    util.redis.clean(sockethubId, function (err) {
      promise.fulfill();
    });
  });
  return promise;
}

// initialize dispatcher
function initDispatcher(config) {
  var promise = promising();
  if (!config.HOST.INIT_DISPATCHER) {
    promise.fulfill(null);
    return promise;
  }

  var proto;
  // load in protocol.js (all the schemas) and perform validation
  try {
    proto = require("./protocol.js");
  } catch (e) {
    throw new util.SockethubError(' [sockethub] unable to load lib/sockethub/protocol.js ' + e, true);
  }

  try {
    dispatcher = require('./dispatcher.js');
  } catch (e) {
    console.error(' [sockethub] unable to load lib/sockethub/dispatcher.js : ' + e);
    promise.reject();
  }

  dispatcher.init(config.HOST.MY_PLATFORMS, sockethubId, proto).then(function () {
    var server;
    try {
      // initialize http server
      server = require('./../servers/http').init(config);
    } catch (e) {
      console.error(' [sockethub] unable to load lib/servers/http ' + e);
      promise.reject();
    }

    var wsServer;
    try {
      // initialize websocket server
      wsServer = require('./../servers/websocket').init(config, server, dispatcher);
    } catch (e) {
      console.error(' [sockethub] unable to load lib/servers/websocket ' + e);
      promise.reject();
    }

    promise.fulfill(dispatcher);
  }, function (err) {
    console.error(" [sockethub] dispatcher failed initialization, aborting");
    promise.reject();
  });
  return promise;
}


function initListenerController(config, root) {
  var promise = promising();
  if (!config.HOST.INIT_LISTENER) {
    promise.fulfill(control);
    return promise;
  }
  var spawn    = require('child_process').spawn;
  var control  = spawn(root+'lib/sockethub/listener-control.js', [sockethubId]);

  control.stdout.on('data', function (data) {
    console.log(__strip(''+data));
  });
  control.stderr.on('data', function (data) {
    console.log(__strip(''+data));
  });
  control.on('close', function (code) {
    console.always('sockethub exiting...');
    process.exit();
  });
  promise.fulfill(control);
  return promise;
}


function __strip(string) {
  return string.replace(/^[\r\n]+|[\r\n]+$/g, "");
}


function init(p) {
  var lcontrol, dispatcher;

  function __shutdown() {
    shutdownDispatcher(dispatcher).then(function() {
      if (lcontrol) {lcontrol.kill('SIGINT');}
      setTimeout(function () {
        process.exit(1);
      }, 10000);
    });
  }

  process.on('SIGINT', function () {
    console.log("\n [sockethub] caught SIGINT");
    __shutdown();
  });

  process.on('SIGTERM', function () {
    console.log("\n [sockethub] caught SIGTERM");
    __shutdown();
  });

  //
  // setup initialization parameters.
  //
  if (!p.root) {
    p.root = "./";
  }
  var configPath = (p.config) ? p.config : p.root + '../../config.js';

  try {
    config = require(configPath).config;
  } catch (e) {
    console.error(' [sockethub] unable to load config: ' + configPath);
    process.exit(1);
  }

  config.DEBUG = p.debug || config.DEBUG || false;
  config.LOG_FILE = p.log || config.LOG_FILE || false;
  config.OUTPUT = (p.output) ? p.output : (config.LOG_FILE) ? false : true;
  sockethubId = p.sockethubId || generateSockethubId();

  //
  // override console behavior
  console = require('./logging.js')({controller: 'sockethub',
                                     console: console,
                                     debug: config.DEBUG,
                                     logfile: config.LOG_FILE,
                                     output: config.OUTPUT});


  check().then(function (config) {
    return prep(config, p.root);
  }).then(function(config) {
    console.debug(' [sockethub] spawning listener control');
    initListenerController(config, p.root).then(function(control) {
      lcontrol = control;
      console.debug(' [sockethub] initializing dispatcher');
      return initDispatcher(config);
    }).then(function (disp) {
      console.always(' [*] finished loading' );
      console.log("\n");
      dispatcher = disp;
    }, function (err) {
      console.error(' [sockethub] ', err);
      console.log(err.stack);
      process.exit(1);
    });

  }, function(err) { console.log(err); });
}

module.exports = {
  init: init
};