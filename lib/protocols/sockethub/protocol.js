var schemas = require('./schema_commands.js');
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

  pub.message = function(d, session, resp) {
    var response = '';
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
      }

      for (var i = 0, num = secrets.length; i < num; i = i + 1) {
        if (secrets[i] === job.object.secret) {
          session.configure(job.object.remoteStorage);
          session.register();
          resp(null);
          return;
        }
      }
    } else {
      resp('unable to register connection, no secret provided.');
    }
    resp('registration failed, invalid secret.');
  };

  return pub;
})();

module.exports = {

  "verbs" : { // validate json with these schemas
    "ping" : { "name" : "ping", "schema" : schemas['ping'] },
    "register" : { "name" : "register", "schema" : schemas['register'] },
    "message" : { "name" : "message", "schema" : schemas['message'] },
    "post" : { "name" : "post", "schema" : schemas['post'] }
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
        }
      }
    },
    "smtp" : {
      "name" : "smtp",
      "verbs" : {
        "message" : {}
      }
    },
    "facebook" : {
      "name" : "facebook",
      "verbs" : {
        "message" : {},
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
        "message" : {}
      }
    }
  }
};
