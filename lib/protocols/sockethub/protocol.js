var schemas = require('./schema_commands.js');
var functions = (function() {
  var pub = {};

  pub.ping = function(d, session) {
    var response = {};
    if (typeof d.timestamp !== 'undefined') {
      response.response = { timestamp: d.timestamp };
    } else {
      response.response = 'invalid json';
    }
    session.send(JSON.stringify(response));
  };

  pub.message = function(d, session) {
    var response = '{}';
    session.send(response);
  };
  return pub;
})();

module.exports = {

  "verbs" : { // validate json with these schemas
    "ping" : { "name" : "ping", "schema" : schemas['ping'] },
    "register" : { "name" : "register", "schema" : schemas['register'] },
    "message" : { "name" : "message", "schema" : schemas['message'] }
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
          "func" : function (job, session) {
            // TODO: implement some 'secret' handling
            session.configure(job.object.remoteStorage);
          }
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
        "message" : {}
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
