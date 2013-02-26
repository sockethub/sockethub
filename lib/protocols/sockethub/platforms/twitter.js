
var twitter = require('ntwitter'),
  promising = require('promising');

module.exports = {
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
              "consumer_key" : {
                "name" : "consumer_key",
                "required" : true,
                "type": "string"
              },
              "consumer_secret" : {
                "name" : "consumer_secret",
                "required" : true,
                "type": "string"
              },
              "access_token_key" : {
                "name" : "access_token_key",
                "required" : true,
                "type": "string"
              },
              "access_token_secret" : {
                "name" : "access_token_secret",
                "required" : true,
                "type": "string"
              }
            }
          }
        }
      }
    }
  },
  init: function (session) {
    var promise = promising();
    this.session = session;
    promise.fulfill();
    return promise;
  },
  post: function (job) {
    var promise = promising();
    try {
      var _this = this;
      var creds = this.session.getConfig('credentials').then(function (creds) {
        _this.session.log('[Twitter]', creds);
        var twit = new twitter(creds);
        twit.verifyCredentials(function (err, data) {
          if (err) {
            promise.fulfill("Error verifying credentials: " + err, false);
          } else {
            _this.session.setConfig('credentials', creds);
          }
        }).updateStatus(job.object.text, function (err, data) {
          if (err) {
            promise.fulfill('Tweeting failed: ' + err, false);
          } else {
            promise.fulfill(null, true, data);
          }
        });
      });
    } catch(e) {
      promise.fulfill(e, false);
    }
    return promise;
  },
  cleanup: function() {}
};
