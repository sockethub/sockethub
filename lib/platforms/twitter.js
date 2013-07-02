var Twit = require('twit');
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
              "access_token" : {
                "name" : "access_token",
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

  function mapProperties (data) {
    //session.log('mapProperties() j: '+ JSON.stringify(data));
    var obj = {
      actor: {},
      target: [],
      object: {}
    };

    try {
      obj.actor.address = data.user.screen_name;
      obj.actor.name = data.user.name;
      obj.actor.id = data.user.id;
      obj.actor.image = data.user.profile_image_url_https;

      // collect mentions
      for (var i = 0, num = data.entities.user_mentions.length; i < num; i = i + 1) {
        obj.target.push({
          address: data.entities.user_mentions[i].screen_name,
          id: data.entities.user_mentions[i].id,
          name: data.entities.user_mentions[i].name,
          type: "cc"
        });
      }

      // collect tags
      obj.object.tags = [];
      for (i = 0, num = data.entities.hashtags.length; i < num; i = i + 1) {
        obj.object.tags.push(data.entities.hashtags[i].text);
      }

      // collect urls
      obj.object.urls = [];
      for (i = 0, num = data.entities.urls.length; i < num; i = i + 1) {
        obj.object.urls.push(data.entities.urls[i].expanded_url);
      }

      obj.object.text = data.text;
      obj.object.date = data.created_ed;
      obj.object.id = data.id;
      obj.object.source = data.source;
    } catch (e) {
      obj = e.toString();
    }
    // /session.log('mapProperties return: '+obj);
    return obj;
  }


  function initTwit(creds) {
    try {
      return new Twit({
        consumer_key: creds.consumer_key,
        consumer_secret: creds.consumer_secret,
        access_token: creds.access_token,
        access_token_secret: creds.access_token_secret
      });
    } catch (e) {
      return e.toString();
    }
  }

  o.init = function (s) {
    var promise = promising();
    session = s;
    promise.fulfill();
    return promise;
  };


  o.fetch = function (job) {
    session.log('fetch');
    var promise = promising();
    try {
      session.getConfig('credentials').then(function (creds) {
        if (!creds[job.actor.address]) {
          promise.reject('unable to get credentials for ' + job.actor.address);
        }
        session.log('got credentials for ' + job.actor.address);
        var twit = initTwit(creds[job.actor.address]);
        if (typeof twit === 'string') {
          promise.reject(twit);
        }

        var endpoint;
        if ((job.target) && (typeof job.target.length !== 'undefined') && (job.target.length >= 1)) {
          // currently just support for first target specified
          if (job.target[0].address === 'user_timeline') {
            // we dont know the username but want the users tweets
            endpoint = 'user_timeline';
          } else {
            endpoint = 'statuses/'+job.target[0].address+'_timeline';
          }
        } else {
          // no target set, use homefeed
          endpoint = 'statuses/home_timeline';
        }

        if ((job.object) && (job.object.poll)) {
          // ongoing stream
          var stream = twit.stream(endpoint);

          stream.on('tweet', function (tweet) {
            session.debug('** got tweet: ', tweet);
            var obj = mapProperties(tweet);
            if (typeof obj === 'string') {
              console.error("error normalizing tweet: "+e);
            } else {
              obj.verb = 'post';
              obj.status = true;
              session.send(obj);
            }
          });

        } else {
          // one-time fetch
          twit.get(endpoint, {}, function (err, replies) {
            if (err) {
              promise.reject(err);
            }
            for (var i = 0, num = replies.length; i < num; i = i + 1) {
              var obj = mapProperties(replies[i]);
              if (typeof obj === 'string') {
                console.error("error normalizing tweet: "+obj);
              } else {
                obj.verb = 'post';
                obj.status = true;
                session.send(obj);
              }
            }
          });
        }

        promise.fulfill(null, true);
      }, function (e) {
        session.log('failed getting credentials: '+e);
        promise.reject(e);
      });
    } catch(e) {
      promise.reject(e);
    }
    return promise;
  };


  o.post = function (job) {
    var promise = promising();
    try {
      session.getConfig('credentials').then(function (creds) {
        if (!creds[job.actor.address]) {
          promise.reject('unable to get credentials for ' + job.actor.address);
        }
        session.log('got credentials for ' + job.actor.address);
        var twit = initTwit(creds[job.actor.address]);
        if (typeof twit === 'string') {
          promise.reject(twit);
        }

        twit.post('statuses/update', { status: job.object.text }, function(err, reply) {
          if (err) {
            console.log('Tweeting failed: ', JSON.stringify(err));
            promise.reject('Tweeting failed: ' + err);
          } else {
            var obj = mapProperties(reply);
            if (typeof obj === "string") {
              session.error('PROBLEM ASSIGNING PROPERTIES: ' + obj);
              promise.reject(obj);
            } else {
              promise.fulfill(null, true, obj.object);
            }
          }
        });
      }, function (e) {
        promise.reject(e);
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
