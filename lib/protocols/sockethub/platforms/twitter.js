
var twitter = require('ntwitter');
var promising = require('promising');

var Twitter = function () {
  var o = {};
  var session;

  o. schema = {
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
  };

  o.init = function (s) {
    var promise = promising();
    session = s;
    promise.fulfill();
    return promise;
  };

  o.post = function (job) {
    var promise = promising();
    try {
      var creds = session.getConfig('credentials').then(function (creds) {
        session.log('credentials:', creds);
        var twit = new twitter(creds);
        twit.verifyCredentials(function (err, data) {
          if (err) {
            promise.reject("Error verifying credentials: " + err, false);
            return;
          } else {
            session.setConfig('credentials', creds);
          }
        }).updateStatus(job.object.text, function (err, data) {
          if (err) {
            promise.reject('Tweeting failed: ' + err, false);
            return;
          } else {
            promise.fulfill(null, true, data);
          }
        });
      });
    } catch(e) {
      promise.reject(e);
    }
    return promise;
  };

  o.cleanup = function() {
    var promise = promising();
    promise.fulfill(null, true, {'message': 'cleanup not implemented yet'});
    return promise;
  };

  return o;
};

module.exports = Twitter;