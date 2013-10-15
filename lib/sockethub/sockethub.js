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
var EventEmitter = require('events').EventEmitter;
var config;
var sockethubId;
// http and websocket server objects
var server = {
  websocket: '',
  http: ''
};
var lcontrol,   // lcontrol - listener control thread
    dispatcher; // dispatcher module object


function generateSockethubId() {
  var randa = Math.floor((Math.random()*10)+1) + new Date().getTime();
  var randb = Math.floor((Math.random()*10)+2) *
            Math.floor((Math.random()*10)+3) /
            Math.floor((Math.random()*10)+4);
  return randa * randb / 1000;
}


/**
 * Function: Sockethub
 *
 * initial bootstrap controller for sockethub. loads config, logging, calls
 * functions for sanity checkes, and for initializing dispatcher and/or
 * listeners.
 *
 * Parameters:
 *
 *   p (object) - an object of parameters as set from the command-line
 *                sockethub executable.
 *
 *   configObj (object) - [optional] this is generally used for testing, but
 *                        is a pre-defined config object to use instead of
 *                        config.js in the root
 *
 *   initialize (boolean) - [optional] whether or not to initialize the
 *                          listeners and dispatchers automatically.
 *                          default: true
 *
 * Returns:
 *
 *   return description
 */
function Sockethub(p, configObj, initialize) {
  initialize = (typeof initialize === 'undefined') ? true : initialize;
  this.events = new EventEmitter();
  var self = this;
  //
  // root of codebase
  if (!p.root) {
    p.root = "./";
  }

  //
  // load config
  if (typeof configObj !== 'object') {
    configFile = (p.configFile) ? p.configFile : p.root + '../../config.js';
    config = require('./config-loader')(configFile, p);
  } else {
    config = require('./config-loader')(configObj, p);
  }

  sockethubId = p.sockethubId || generateSockethubId();

  //
  // override console behavior
  console = require('./logging.js')({controller: 'sockethub',
                                     console: console,
                                     debug: config.DEBUG,
                                     logfile: config.LOG_FILE,
                                     output: config.OUTPUT});

  check().then(function (config) {
      // prepExamples if needed
      return Sockethub.prototype.prepExamples(p.root);
  }).then(function() {
    console.debug(' [sockethub] spawning listener control');

    if (initialize) {
      // automatic initialization of sockethub
      Sockethub.prototype.initListenerController(p.root).then(function(control) {
        lcontrol = control;
        console.debug(' [sockethub] initializing dispatcher');
        return Sockethub.prototype.initDispatcher();
      }).then(function (disp) {
        console.debug(' [sockethub] initialization dispatcher: '+typeof disp);
        console.always(' [*] finished loading');
        //console.log("\n");
        self.sessionManager = disp.sessionManager;
        dispatcher = disp;
        self.events.emit('initialized');
      }, function (err) {
        console.error(' [sockethub] ', err);
        console.log(err.stack);
        //process.exit(1);
        throw new Error(err, err.stack);
      });

    }
  }, function(err) { console.log(err); });

}

Sockethub.prototype.shutdown = function () {
  console.log('shutting down sockethub...');
  console.debug('shutting down dispatcher...');
  Sockethub.prototype.shutdownDispatcher(dispatcher).then(function() {

    if (lcontrol) {
      console.debug('shutting down listeners...');
      lcontrol.kill('SIGINT');
    }

    if (server.http) {
      console.debug('shutting down http server... ');
      server.http.close();
    }

    if (server.websocket) {
      console.debug('shutting down websocket server... ');
      server.websocket.close();
    }

  });
};


//
// perform config sanity checks, redis version and connectivity
//
function check() {
  var promise = promising();
  if (!config) {
    console.error(' [sockethub] nothing found in config, exiting.');
    throw new Error('nothing found in config, exiting.');
    //process.exit(1);
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
  console.debug(" [sockethub] verifying redis connection");
  util.redis.check(function (err) {
    if (err) {
      console.error(' [sockethub] REDIS ERROR: '+err);
      promise.reject();
      //process.exit();
    } else {
      console.info(' [sockethub] redis check successful');
      promise.fulfill(config);
    }
  });
  return promise;
}


//
// prep the examples config.js
Sockethub.prototype.prepExamples = function (root) {
  var promise = promising();
  if (config.EXAMPLES.ENABLE) {
    promise.fulfill();
    return promise;
  }

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
};


Sockethub.prototype.shutdownDispatcher = function (dispatcher) {
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
};

// initialize dispatcher
Sockethub.prototype.initDispatcher = function () {
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
    try {
      // initialize http server
      server.http = require('./../servers/http').init(config);
    } catch (e) {
      console.error(' [sockethub] unable to load lib/servers/http ' + e);
      promise.reject();
    }

    try {
      // initialize websocket server
      server.websocket = require('./../servers/websocket').init(config, server.http, dispatcher);
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
};


Sockethub.prototype.initListenerController = function (root) {
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
    console.debug(' [sockethub] close event received from listener-controller...');
    //process.exit();
  });
  promise.fulfill(control);
  return promise;
};


function __strip(string) {
  return string.replace(/^[\r\n]+|[\r\n]+$/g, "");
}




module.exports = function (a, b, c) {
  return new Sockethub(a, b, c);
};
