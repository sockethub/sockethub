var https = require('https');
var promising = require('promising');

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
  },
  init: function (session) {
    var promise = promising();
    this.session = session;
    promise.fulfill();
    return promise;
  },
  post: function (job) {
    var promise = promising();
    this.session.log('facebook post called');
    var _this = this;
    this.session.getConfig('credentials').then(function (credentials) {
      _this.session.log('got credentials');
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
        _this.session.log('result function: '+res.satus);
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
          _this.session.log('got chunk '+chunk);
          var data = JSON.parse(chunk);
          _this.session.log('does chunk have error? ' + typeof data.error);
          if (typeof data.error !== 'undefined') {
            object = data.error;
            gotError = true;
          } else {
            object = data;
          }
          //session.send('got chunk '+chunk); // What is this for?
        });
        res.on('end', function() {
          //session.send('response end with status '+res.status); // What is this for?
          _this.session.log('on end called gotError:'+gotError);
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
  },
  send: function(job) {
    _this.session.log('facebook send called');
    var promise = promising();
    promise.reject('facebook.send unimplemented');
    return promise;
  },
  cleanup: function() {
    var promise = promising();
    promise.fulfill();
    return promise;
  }
};
