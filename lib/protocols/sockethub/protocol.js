var schemas = require('./verbs_schema.js');
var functions = (function() {
  var pub = {};

  pub.ping = function(d, session, resp) {
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
    if (typeof job.object.secret === 'string') {
      var secrets;
      try {
        secrets = require('./../../../config.secrets');
      } catch (e) {
        resp('unable to read from config.secrets.js, cannot verify secret');
        return;
      }

      for (var i = 0, num = secrets.length; i < num; i = i + 1) {
        if (secrets[i] === job.object.secret) {
          session.setConfig('remoteStorage', job.object.remoteStorage);
          session.register(secrets[i]);
          resp(null);
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
      platform = require('platforms/'+job.target.platform);
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
        console.log(' [dispatcher:set] job.object schema validated');
      }
    } else {
      resp('platform has to schema defined for set operations. cannot validate request');
      return;
    }


    // set the value of object into a redis session DB, with the key
    // being the secret:sid:actor.address(platform):target.address

    //var redis = require('redis');
    //var client = redis.createClient();
    //client.hset('session:'+session.getSecret+':, '')

    var psession = session.getPlatformSession(job.target.platform);


  };

  return pub;
}());

//
//  this defines the list of platforms, with links to their per-verb schemas for
// validations, and listing the valid verbs for the platform.
//
// note that you only specify a function in the platforms->[platform]->[verb] area
// the platform does not have an actual platform file. This is mostly only used for
// minor, internal, helper functions or dispatcher related functions like register or ping.
//
// ** platform developers should not be adding "func" directives here.
//
module.exports = {

  "verbs" : { // validate json with these schemas
    "ping" : { "name" : "ping", "schema" : schemas['ping'] },
    "register" : { "name" : "register", "schema" : schemas['register'] },
    "send" : { "name" : "send", "schema" : schemas['send'] },
    "post" : { "name" : "post", "schema" : schemas['post'] },
    "set" : { "name" : "set", "schema" : schemas['set'] }
  },

  "platforms" : {
    "dispatcher" : {
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
    },
    "email" : {
      "name" : "email",
      "verbs" : {
        "send" : {
          "name": "send"
        }
      }
    },
    "facebook" : {
      "name" : "facebook",
      "verbs" : {
        "send" : {
          "name": "send"
        },
        "post": {
          "name": "post"
        }
      }
    },
    "twitter" : {
      "name" : "twitter",
      "verbs" : {
        "post": {
          "name": "post"
        }
      }
    },
    "xmpp" : {
      "name" : "xmpp",
      "verbs" : {
        "send" : {
          "name": "send"
        }
      }
    }
  }
};
