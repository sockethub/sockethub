/**
 * This file is part of sockethub.
 *
 * copyright 2012-2013 Nick Jennings (https://github.com/silverbucket)
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
var Q = require('q');

/**
 * Class: Facebook
 *
 * Handles all actions related to interacting with the Facebook API.
 *
 */
function Facebook() {}
Facebook.prototype.schema = {
  "set": {
    "credentials" : {
      "required": ['object'],
      "properties": {
        "object": {
          "name": "object",
          "type": "object",
          "required": ['objectType', 'access_token'],
          "additionalProperties": false,
          "properties": {
            "objectType": {
              "name": "objectType",
              "type": "string"
            },
            "access_token": {
              "name": "access_token",
              "type": "string"
            }
          }
        }
      }
    }
  }
};

Facebook.prototype.init = function (s) {
  var q = Q.defer();
  this.session = s;
  this.sessionId = s.getSessionID();
  q.resolve();
  return q.promise;
};

Facebook.prototype.fetch = function (job) {
  var q = Q.defer();
  var session = this.session;

  if ((!job.target) && (typeof job.target.length === 'undefined')) {
    q.reject('no target(s) specified');
    return;
  }

  session.getConfig('credentials', job.actor.address).then(function (creds) {
    var sentError = false;

    job.target.forEach(function (t) {
      var buffer = '';
      var req = https.request({
        host: 'graph.facebook.com',
        port: 443,
        path: '/'+t.address+'/feed?access_token=' +
                encodeURIComponent(creds.object.access_token),
        method: 'GET'
      }, function (res) {
        session.log('result function: ' + res);
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
          console.log('adding chunk');
          buffer = buffer + chunk;
        });
        res.on('end', function () {
          var data;
          try {
            data = JSON.parse(buffer);
          } catch (e) {
            q.reject(e);
            return;
          }

          if (data.error) {
            q.reject(data.error.message);
            return;
          } else if ((!data.data) || (typeof data.data.length === 'undefined')) {
            q.resolve({message:'no result'});
            return;
          } else {
            data.data.forEach( function (e) {
              session.send({
                verb: 'post',
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
          }
          q.resolve();
        });
      });

      req.on('error', function (e) {
        console.log('ERROR: ', e);
        sentError = true;
        q.reject(e.message, e);
      });

      req.end();
    });

    setTimeout(function () {
      if (!sentError) {
        // all requests sent, return true result as response
        q.resolve();
      }
    }, 3000);
  }, q.reject).fail(q.reject);

  return q.promise;
};

Facebook.prototype.post = function (job) {
  var q = Q.defer();
  var session = this.session;
  session.log('facebook post called');

  session.getConfig('credentials', job.actor.address).then(function (creds) {
    session.log('got credentials');
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
          q.reject(object.message, object);
        } else {
          q.resolve(object);
        }
      });
    });
    req.end('message=' + encodeURIComponent(job.object.text) +
            '&access_token=' + encodeURIComponent(creds.object.access_token));
  }, function() {
    q.reject('could not get credentials');
  }).fail(q.reject);
  return q.promise;
};

Facebook.prototype.send = function (job) {
  this.session.log('facebook send called');
  var q = Q.defer();
  q.reject('facebook.send unimplemented');
  return q.promise;
};

Facebook.prototype.cleanup = function () {
  var q = Q.defer();
  q.resolve();
  return q.promise;
};

module.exports = function () {
  return new Facebook();
};