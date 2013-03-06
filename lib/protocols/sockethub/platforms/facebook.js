if (typeof(https) !== 'object') {
  https = require('https');
}
var promising = require('promising');

var Facebook = function () {
  var o = {};
  var session;

  o.schema = {
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
                  "address" : {
                    "name" : "address",
                    "required" : true,
                    "type": "string"
                  }
                }
              },
              "access_token": {
                "name": "access_token",
                "type": "string",
                "required": true
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
    session.log('facebook post called');
    session.getConfig('credentials').then(function (credentials) {
      session.log('got credentials');
      console.log('credentials:', credentials);
      if (typeof credentials[job.actor.address] === 'undefined') {
        promise.reject('unable to get credential details for '+job.actor.address);
        return;
      }
      var creds = credentials[job.actor.address];
      var object;
      var gotError = false;

      var req = https.request({
        host: 'graph.facebook.com',
        path: '/'+job.actor.address+'/feed',
        method: 'POST'
      }, function (res) {
        session.log('result function: '+res.satus);
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          session.log('got chunk '+chunk);
          var data = JSON.parse(chunk);
          session.log('does chunk have error? ' + typeof data.error);
          if (typeof data.error !== 'undefined') {
            object = data.error;
            gotError = true;
          } else {
            object = data;
          }
          //session.log('got chunk '+chunk); // What is this for?
        });
        res.on('end', function() {
          session.log('on end called gotError:'+gotError);
          if (gotError) {
            promise.fulfill(object.message, false, object);
          } else {
            promise.fulfill(null, true, object);
          }
        });
      });
      req.end('message=' + encodeURIComponent(job.object.text) +
              '&access_token=' + encodeURIComponent(creds.access_token));
    }, function() {
      promise.reject('could not get credentials');
    });
    return promise;
  };

  o.send = function (job) {
    session.log('facebook send called');
    var promise = promising();
    promise.reject('facebook.send unimplemented');
    return promise;
  };

  o.cleanup = function () {
    var promise = promising();
    promise.fulfill();
    return promise;
  };

  return o;
};
module.exports = Facebook;
