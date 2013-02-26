var smtp = require('./smtp-implementation');
//var pop = require('./pop-implementation');
var data = {
  schema: {
    "set": {
      "credentials" : {
        "type": "object",
        "required": false,
        "patternProperties" : {
          ".+": {
            "type": "object",
            "required": true,
            "properties": {
              "actor": {
                "type": "object",
                "required": false,
                "properties" : {
                  "name" : {
                    "name" : "name",
                    "required" : false,
                    "type": "string"
                  },
                  "address" : {
                    "name" : "address",
                    "required" : false,
                    "type": "string"
                  }
                }
              },
              "smtp": {
                "type": "object",
                "required": false,
                "properties" : {
                  "host" : {
                    "name" : "host",
                    "required" : true,
                    "type": "string"
                  },
                  "username" : {
                    "name" : "username",
                    "required" : true,
                    "type": "string"
                  },
                  "password" : {
                    "name" : "password",
                    "required" : true,
                    "type": "string"
                  },
                  "secure" : {
                    "name" : "secure",
                    "required" : false,
                    "type": "string"
                  },
                  "port" : {
                    "name" : "port",
                    "required" : false,
                    "type": "string"
                  },
                  "domain" : {
                    "name" : "domain",
                    "required" : false,
                    "type": "string"
                  },
                  "mimeTransport" : {
                    "name" : "mimeTransport",
                    "required" : false,
                    "type": "string"
                  },
                  "gpg": {
                    "type": "object",
                    "required": false,
                    "properties" : {
                      "homedir" : {
                        "name" : "domain",
                        "required" : true,
                        "type": "string"
                      },
                      "passphrasefile" : {
                        "name" : "mimeTransport",
                        "required" : true,
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
var promising = require('promising');
var session;
data.init = function (session) {
  var promise = promising();
  session.log('initializing');
  smtp.init(session).then(function () {
    promise.fulfill();
  }, function (err) {
    promise.reject(err);
  });
  return promise;
};
data.send = function (job) {
  return smtp.send(job);
};
// should call each sub-modules cleanup function
data.cleanup = function cleanup() {
  smtp.cleanup();
};

module.exports = data;