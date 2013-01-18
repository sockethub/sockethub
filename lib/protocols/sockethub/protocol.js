var schemas = require('./schema_commands.js');
var functions = (function() {
  var pub = {};

  pub.ping = function(promise, d) {
    var response = {};
    if (typeof d.timestamp !== 'undefined') {
      response.response = { timestamp: d.timestamp };
    } else {
      response.response = 'invalid json';
    }
    promise.fulfill(JSON.stringify(response));
  };

  pub.message = function(promise, d) {
    var response = '{}';
    promise.fulfill(response);
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
          "func" : function (promise, job) {
            var remoteStorageSettings = job.object.remoteStorage
            console.log("REGISTER", remoteStorageSettings);
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
    }
  }
};