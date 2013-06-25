require("consoleplusplus/console++");
var util = require('./util.js');
var posix = require('posix');
var promising = require('promising');
var fs = require('fs');
//var control = require('./lib/sockethub/control.js');

function check() {
  var promise = promising();
  var config = require('./../../config.js').config;

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
  util.redis.check(function(err) {
    if (err) {
      console.error(' [sockethub] REDIS ERROR: '+err);
      promise.reject();
    } else {
      console.info(' [sockethub] redis check successful');
      promise.fulfill(config);
    }
  });
  return promise;
}

function prep(config, path) {
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
  console.log('PATH: '+path.root+"/examples/connect-config.js");
  fs.writeFile(path.root+"/examples/connect-config.js", fileContents, function (err) {
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

function __strip(string) {
  return string.replace(/^[\r\n]+|\.|[\r\n]+$/g, "");
}

function init(path) {
  if (!path.root) {
    path.root = "./";
  }
  check().then(function (config) {
    return prep(config, path);
  }).then(function(config) {
    var spawn    = require('child_process').spawn;
    var control  = spawn(path.root+'lib/sockethub/control.js', []);
    process.on('SIGINT', function () {
      console.log("\nSOCKETHUB: caught SIGINT (Ctrl+C)");
      control.kill('SIGINT');
    });
    process.on('SIGILL', function () {
      console.log("\nSOCKETHUB: caught SIGILL");
      control.kill('SIGINT');
    });
    process.on('SIGHUP', function () {
      console.log("\nSOCKETHUB: caught SIGHUP");
      control.kill('SIGINT');
    });
    process.on('SIGTERM', function () {
      console.log("\nSOCKETHUB: caught SIGTERM");
      control.kill('SIGINT');
    });

    control.stdout.on('data', function (data) {
      console.log(__strip(''+data));
    });
    control.stderr.on('data', function (data) {
      console.log(__strip(''+data));
    });
    control.on('close', function (code) {
      control.kill('SIGINT');
      console.log('sockethub control exited with code: '+code);
    });
  }, function(err) { console.log(err); });
}

module.exports = {
  init: init
};


