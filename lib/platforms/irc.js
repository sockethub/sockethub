var irc = require('irc');

var IRC = function () {
  var session;
  var schema = {
    "set": {
      "additionalProperties": false,
      "properties": {
        "credentials" : {
          "type": "object",
          "required": true,
          "patternProperties" : {
            ".+": {
              "type": "object",
              "required": true,
              "additionalProperties": false,
              "properties": {
                "actor": {
                  "type": "object",
                  "required": false,
                  "additionalProperties": false,
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
                "nick" : {
                  "name" : "nick",
                  "required" : true,
                  "type": "string"
                },
                "password" : {
                  "name" : "password",
                  "required" : false,
                  "type": "string"
                },
                "server" : {
                  "name" : "server",
                  "required" : true,
                  "type": "string"
                },
                "channels" : {
                  "name" : "channels",
                  "required" : false,
                  "type": "array"
                }
              }
            }
          }
        }
      }
    }
  };

  var init = function (sess) {
    session = sess;
    var promise = session.promising();
    promise.fulfill();
    return promise;
  };

  var join = function (job) {
    var promise = session.promising();
    promise.fulfill();
    return promise;
  };

  var send = function (job) {
    var promise = session.promising();
    promise.fulfill();
    return promise;
  };

  var fetch = function (job) {
    var promise = session.promising();
    promise.fulfill();
    return promise;
  };

  var cleanup = function (job) {
    var promise = session.promising();
    promise.fulfill();
    return promise;
  };

  return {
    schema: schema,
    init: init,
    join: join,
    send: send,
    fetch: fetch,
    cleanup: cleanup
  };
};

module.exports = IRC;