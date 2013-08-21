/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

if (typeof(https) !== 'object') {
  https = require('https');
}
var promising = require('promising');

var Facebook = function () {
  var pub = {};
  var session;

  pub.schema = {
    "set": {
      "additionalProperties": false,
      "properties" : {
        "credentials" : {
          "name": "credentials",
          "type": "object",
          "required": false,
          "patternProperties" : {
            ".+": {
              "type": "object",
              "required": true,
              "additionalProperties": false,
              "properties": {
                "actor": {
                  "type": "object",
                  "required": false,
                  "properties" : {
                    "address" : {
                      "name" : "address",
                      "required" : true,
                      "type": "string"
                    },
                    "name" : {
                      "name" : "name",
                      "required" : false,
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
    }
  };

  pub.init = function (s) {
    var promise = promising();
    session = s;
    promise.fulfill();
    return promise;
  };

  pub.fetch = function (job) {
    var promise = promising();

    session.getConfig('credentials').then(function (credentials) {
      if (typeof credentials[job.actor.address] === 'undefined') {
        promise.reject('unable to get credential details for '+job.actor.address);
        return;
      }
      creds = credentials[job.actor.address];

      var sentError = false;
      job.target.forEach(function (t) {
        var buffer = '';
        var req = https.request({
          host: 'graph.facebook.com',
          port: 443,
          path: '/'+t.address+'/feed?access_token=' +
                  encodeURIComponent(creds.access_token),
          method: 'GET'
        }, function (res) {
          session.log('result function: ' + res);
          res.setEncoding('utf8');
          res.on('data', function (chunk) {
            console.log('adding chunk');
            buffer = buffer + chunk;
          });
          res.on('end', function () {
            promise.fulfill();
            var data = JSON.parse(buffer);

            data.data.forEach( function (e) {
              session.send({
                verb: 'add',
                actor: {
                  name: e.from.name,
                  address: e.from.id
                },
                object: {
                  subject: e.name,
                  link: e.link,
                  icon: e.icon,
                  type: e.type,
                  status_type: e.status_type,
                  image: e.picture,
                  date: e.created_time,
                  id: e.object_id,
                  brief_text: e.message,
                  text: e.description
                },
                status: true
              });
            });

          });
        });

        req.on('error', function (e) {
          console.log('ERROR: ', e);
          sentError = true;
          promise.reject(e.message, e);
        });

        req.end();
      });

      setTimeout(function () {
        if (!sentError) {
          // all requests sent, return true result as response
          promise.fulfill();
        }
      }, 3000);
    });
    return promise;
  };

  pub.post = function (job) {
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
            promise.reject(object.message, object);
          } else {
            promise.fulfill(object);
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

  pub.send = function (job) {
    session.log('facebook send called');
    var promise = promising();
    promise.reject('facebook.send unimplemented');
    return promise;
  };

  pub.cleanup = function () {
    var promise = promising();
    promise.fulfill();
    return promise;
  };

  return pub;
};
module.exports = Facebook;
