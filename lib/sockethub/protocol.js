var verbs = require('./../schemas/verbs.js');
var platforms = require('./../schemas/platforms.js');

var functions = (function() {
  var pub = {};

  pub.ping = function (d, session, resp) {
    var response = {};
    if (typeof d.timestamp !== 'undefined') {
      response.timestamp = d.timestamp;
    } else {
      response = 'invalid json';
    }
    resp(null, response);
  };

  pub.register = function (job, session, resp) {
    // some 'secret' handling
    // load the secret file, and check for a valid
    // match.
    console.debug(' [dispatcher] received register request');
    if (typeof job.object.secret === 'string') {
      var secrets;
      try {
        secrets = require('./../../config.secrets');
      } catch (e) {
        resp('unable to read from config.secrets.js, cannot verify secret');
        return;
      }

      for (var i = 0, num = secrets.length; i < num; i = i + 1) {
        if (secrets[i] === job.object.secret) {
          session.register(secrets[i]);
          if (job.object.remoteStorage) {
            session.setConfig('remoteStorage', job.object.remoteStorage);
          }
          resp(null, {sessionId: ""+session.getSessionID()});
          return;
        }
      }
    } else {
      resp('unable to register connection, no secret provided.');
    }
    resp('registration failed, invalid secret.');
  };

  pub.set = function (job, session, resp) {
    // validate job.object against the platforms schema
    var platform;
    try {
      platform = require('./../platforms/'+job.target.platform)();
    } catch (e) {
      resp('unable to load platform '+job.target.platform);
      return;
    }

    if ((typeof platform.schema === 'object') && (typeof platform.schema.set === 'object')) {
      var JSVlib = require('JSV').JSV; // json schema validator
      var jsv = JSVlib.createEnvironment();
      var report = jsv.validate(job.object, platform.schema.set);
      if (report.errors.length !== 0) {  // protocol.js json errors
        resp('invalid object format '+JSON.stringify(report.errors));
      } else {
        console.debug(' [dispatcher:set] job.object schema validated');
      }
    } else {
      resp('platform has to have a schema defined for set operations. cannot validate request');
      return;
    }


    // set the value of object into a redis session DB
    session.getPlatformSession(job.target.platform).then(function (psession) {
      var keys = Object.keys(job.object);
      for (var i = 0, num = keys.length; i < num; i = i + 1) {
        if (keys[i] === '@type') { continue; }
        console.info(' [dispatcher:set] setting config for key ['+keys[i]+']');
        psession.setConfig(keys[i], job.object[keys[i]]).then(function () {
          resp(null);
        }, function (err) {
          resp(err);
        });
      }
    });

  };

  return pub;
}());


// note that you only specify a function in the platforms->[platform]->[verb] area
// the platform does not have an actual platform file. This is mostly only used for
// minor, internal, helper functions or dispatcher related functions like register or ping.
// ** platform developers should not be adding "func" directives.
platforms['dispatcher'] = {
  "name" : "dispatcher",
  "local" : true,
  "verbs" : {
    "ping": {
      "name" : "ping",
      "func" : functions.ping // if func is set, we dont send to redis queue
    },
    "register" : {
      "name" : "register",
      "func" : functions.register
    },
    "set" : {
      "name" : "set",
      "func" : functions.set
    }
  }
};

module.exports = {
  platforms: platforms,
  verbs: verbs
};
