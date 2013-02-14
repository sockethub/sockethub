/**
 * Function: Session
 *
 * The Session object handles all session related persistent information.
 * Anything not tied to a specific job should be cached in the session
 * variable. This includes data passed during register (remoteStorage access
 * details).
 *
 * The session object also issues per-platform sessions (psession) which provides
 * an interface for session related info applicable to that platform. It stores
 * credential details (passed during subscribe command) and also provides a
 * response object (psession.send).
 *
 */

var promising = require('promising');
var curry = require('curry');
var http = require('http');
var https = require('https');
var url = require('url');
var redis = require('redis');


// merge two objects together, o1 being the base object, o2 being the new
// object to add to o1.
function mergeObjects(o1, o2) {
  for (var i in o2) {
    if (!o1[i]) {
      o1[i] = o2[i];
    } else {
      if ((typeof o1[i] === 'object') && (typeof o2[i] === 'object')) {
        mergeObjects(o1[i],o2[i]);
      } else {
        o1[i] = o2[i];
      }
    }
  }
  return o1;
}

//
// create the session instance for the given session ID.
// - If it exists in memory, it's returned.
// - If it exists in the redis store, it's retreived and built for a local
// instance.
// - If the session doesn't exist yet, a new one will be created.
//
var get = function (sid) {
  var promise = promising();

  if (sid in Session.prototype.instances) {
    console.log(' [session] retrieved locally, sid ' + sid + '.');
    // session lives locally, return it.
    promise.fulfill(Session.prototype.instances[sid]);
    return promise;
  }

  var client = redis.createClient();
  var redis_key = 'sockethub:session:'+sid+':_internal';
  var session;

  // check redis Db for existing session entry.
  client.get(redis_key, function (err, reply) {
    if (!reply) {
      // session does not exist. crete one.
      session = new Session(sid);
      console.log(' [session] created sid ' + sid + '.');
    } else {
      // session exists, create local session object, passing reply data
      session = new Session(sid, reply);
      console.log(' [session] retreived from redis, sid ' + sid + '.');
    }
    Session.prototype.instances[sid] = session;
    promise.fulfill(session);
  });

  return promise;
};




function Session(sid, redisdata) {
  var pub = {};
  var _ = {
    platforms: {},  // platforms used by this session
    registered: false,
    secret: '',
    redis_key: '' // sockethub:session:'+sid; // needs ':<platform>' (or _internal) appended
  };

  pub.getSessionID = function () {
    return sid;
  };

  // internal function, only exposed with a curry for platform name.
  function setConfig(platform, name, _config) {
    var promise = promising();
    // store _config in redis hash ...
    var client = redis.createClient();
    client.hget(_.redis_key+platform, name, function (err, reply) {
      var obj;
      if (reply) {
        obj = mergeObjects(JSON.parse(reply), _config);
      } else {
        obj = _config;
      }
      client.hset(_.redis_key+platform, name, JSON.stringify(obj), function (err, replies) {
        promise.fulfill();
      });
    });

    // we'll also need to have the redis session data cleared out when
    // a session is closed.
    // if we store by secret, then how will we know when to clear out a
    // redis hash for that secret? -- currently we store by secret:sid so
    // we don't have to cross that bridge yet.
    return promise;
  }

  function getConfig(platform, name, refresh) {
    console.log('getConfig:'+platform+', '+name);
    var promise = promising();

    // grab from remoteStorage
    function getConfigRemoteStorage() {
      if (platform !== '_internal') {
        pub.getFile('sockethub', name + '/' + platform).then(function (source, resource) {
          if (typeof resource.mimeType === 'undefined') {
            setConfig(platform, name, resource).then(function () {
              promise.fulfill(JSON.parse(resource));
            });
          } else {
            console.log(' [session] retrieved non-file from ' + source + ':/sockethub/' +
                          name + '/' + platform); // + ' -- resource:'+ JSON.stringify(resource));
            promise.reject('could not get ' + name + ' for ' + platform + ' platform');
          }
        });
      }
    }

    if (!refresh) { // get from redis
      var client = redis.createClient();
      client.hget(_.redis_key+platform, name, function (err, reply) {
        if (!reply) {
          if (name !== 'remoteStorage') {
            getConfigRemoteStorage();  // try to get from remoteStorage
          } else {
            promise.reject('could not get ' + name + ' for ' + platform + ' platform');
          }
        } else {
          promise.fulfill(JSON.parse(reply));
        }
      });
    }

    return promise;
  }

  // Configure the session, usually due to a REGISTER command.
  //
  // "settings" look like this:
  //   {
  //     storageInfo: {
  //       type: '...',
  //       href: '...',
  //     },
  //     bearerToken: '...',
  //     scope: {
  //       '...' : 'rw'
  //     }
  //   }
  //
  pub.setConfig = curry(['_internal'], setConfig);
  // get the config for the specified data branch. first check local memory
  // then, if not there, get from redis.
  pub.getConfig = curry(['_internal'], getConfig);


  // Send a command back through the socket.
  // Parameters:
  //   platform - Platform sending the message
  //   verb     - Verb of the command, such as "message".
  //   actor    - The acting entity that the command originated from
  //   target   - The receiving entity that the command is sent to
  //   object   - Payload data of the command
  //   rid      - ID to identify the command
  //
  // TODO: get rid of 'platform' parameter somehow.
  function send(p) {
    var send_channel = 'dispatcher:outgoing:' + sid;
    var client = redis.createClient();
    var json_msg = JSON.stringify(p);
    console.log(' [session] sending message on channel ' + send_channel + ": " + json_msg);
    client.rpush(send_channel, json_msg);
  }
  pub.send = send;


  _.purgeConfig = function (platform) {
    var client = redis.createClient();
    var platforms;
    if (platform) {
      platforms = [platform];
    } else {
      platforms = pub.getPlatforms();
      platforms.push('_internal');
    }
    //console.log('redis key:',_.redis_key);
    for (var i = 0, num = platforms.length; i < num; i = i + 1) {
      console.log(' [session] purging config for '+_.redis_key+platforms[i]);
      client.del(_.redis_key+platforms[i]);
    }
  };

  // Reset the session.
  pub.reset = function() {
    _.purgeConfig();
    _.platforms = {};
    _.secret = {};
    _.registered = false;
    _.redis_key = '';
  };

  pub.register = function (secret) {
    if (secret) {
      _.secret = secret;
      _.registered = true;
      _.redis_key = 'sockethub:session:'+sid+':'; // needs <platform> (or '_internal') appended
      //console.log('register - redis key:'+_.redis_key);
      _.purgeConfig('_internal');
      return true;
    } else {
      // must have the secret passed during register
      return false;
    }
  };
  pub.unregister = function () {
    _.registered = false;
  };
  pub.isRegistered = function () {
    return _.registered;
  };
  pub.getSecret = function() {
    return _.secret;
  };
  pub.getSessionID = function() {
    return _.secret;
  };

  pub.getResponseHandler = function (job) {
    var p = {
      platform: job.platform,
      verb: job.verb,
      rid: job.rid
    };
    return function (errMsg, status, object) {
        if (errMsg) {
          p.errMsg = errMsg;
        }
        p.status = status;
        if (object) {
          p.object = object;
        }
        send(p);
      };
  };


  function platformSession(platform, predisdata) {
    var ppub = {};

    ppub.setConfig = curry([platform], setConfig);
    ppub.getConfig = curry([platform], getConfig);

    ppub.send = function (p) {
      p.platform = platform;
      if ((!p.verb) || (!p.actor) || (p.rid) || (p.target) || (!p.object)) {
        throw "recevied invalid object to send to client, missing basic set of properties";
      }
      send(p);
    };

    ppub.log = function(msg) {
      console.log(' [platform:' + platform + '] ' + msg);
    };

    return ppub;
  }

  pub.getPlatformSession = function (platform) {
    var promise = promising();

    if (platform in _.platforms) {
      // session lives locally, return it.
      console.log(' [session] retreived locally, platform session for ' + platform + '.');
      promise.fulfill(_.platforms[platform]);
    } else {
      var client = redis.createClient();
      var psession;

      // check redis Db for existing session entry.
      client.get(_.redis_key+platform, function (err, reply) {
        if (!reply) {
          // session does not exist. crete one.
          psession = new platformSession(platform);
          console.log(' [session] created platform session for ' + platform + '.');
        } else {
          // session exists, create local session object, passing reply data
          psession = new platformSession(platform, reply);
          console.log(' [session] retreived from redis, platform session for ' + platform + '.');
        }
        _.platforms[platform] = psession;
        promise.fulfill(psession);
      });
    }
    return promise;
  };


  /**
   * Function: getFile
   *
   * Get a file, if possible from remote storage, otherwise try from the
   * filesystem.
   *
   * Parameters:
   *
   *   module - base directory/module
   *   path   - path (append to module) including filename
   *
   * Returns:
   *
   *   returns a promise, which can fulfill as two values: (source, resource)
   *     source - the place the resource was retreived from,
   *              'remotestorage' 'filesystem'
   *     resource - the JSON object (in some cases could be a directory listing)
   */
  pub.getFile = function (module, path) {
    var promise = promising();
    //console.log('getFile called:'+module+' '+path);
    pub.getConfig('remoteStorage').then(function (rsConfig) {
      if (typeof rsConfig.scope === 'object') {
        var modules = Object.keys(rsConfig.scope);
        var match = false;
        for (var i = 0, len = modules.length; i < len; i = i + 1) {
          if (modules[i] === module) {
            match = true;
            break;
          }
        }
        // we have access to this module in remotestorage, lets try and get it.
        if (match) {
          _.getRS(module, path).then(function (resource) {
            promise.fulfill('remotestorage', resource);
          });
        } else {
          // TODO XXX FIXME: implement _.getFS()
          promise.reject('unable to retreive resource from your remote storage: ' + module + ' ' + path);
        }
      } else {
        promise.reject('no scope defined');
      }
    }, function (err) {
      promise.reject(err);
    });
    return promise;
  };

  // Get a file from remoteStorage.
  //
  // Example:
  //   // will GET {storageRoot}/messages/.xmpp and (if applicable)
  //   // parse it's content as JSON.
  //   rgetRS('sockethub', 'credentials/email')
  //
  // Returns:
  //   Either the parsed JSON object (if Content-Type: application/json), or
  //   an object of the form { mimeType: '...', data: '...' }.
  _.getRS = function (module, path) {
    var promise = promising();
    pub.getConfig('remoteStorage').then(function (rsConfig) {
      if(! rsConfig) {
        promise.reject("Not configured yet!!!");
      } else {
        //console.log('rsConfig:',rsConfig);
        return Session.prototype.request(rsConfig, 'GET', module + '/' + path).
          then(function(response) {
            if(response.mimeType === 'application/json') {
              promise.fulfill(JSON.parse(response.data));
            } else {
              promise.fulfill(response);
            }
          });
      }
    });
    return promise;
  };

  // Get a list of all platforms used by this session so far.
  pub.getPlatforms = function() {
    return Object.keys(_.platforms);
  };

  return pub;
}

Session.prototype.instances = {};

/**
 * Function: request
 *
 * request a document from remoteStorage
 *
 * Parameters:
 *
 *   rsSettings - settings object containing rs config
 *   method   - GET POST, etc.
 *   path     - full path of request
 *   mimeType - for writes (POST), this specifies the mimetype
 *   body     - for writes (POST), this specifies the content body
 *
 * Returns:
 *
 *   returns a promise which is fulfilled when the document retreival is completed
 */
Session.prototype.request = function(rsSettings, method, path, mimeType, body) {
  console.log(' [session] request: '+method+' '+path);
  var promise = promising();
  if(rsSettings.storageInfo && rsSettings.storageInfo.href && rsSettings.bearerToken) {
    var options = url.parse(rsSettings.storageInfo.href);
    options.headers = { 'Authorization': 'Bearer ' + rsSettings.bearerToken };
    options.method = method;
    if (path.charAt(0) === '/') {
      options.path += path;
    } else {
      options.path += '/' + path;
    }

    if(mimeType) {
      options.headers['Content-Type'] = mimeType + '; charset=UTF-8';
    }

    console.log(' [session] https options: '+JSON.stringify(options));
    var req;
    try {
      if (options.protocol === 'http:') {
        req = http.request(options);
      } else {
        req = https.request(options);
      }
    } catch (e) {
      console.log(' [session] error with request: ' + e);
      promise.reject();
      return false;
    }

    req.on('error', function (e) {
      console.log(' [session] request caught error: ' + e);
      promise.reject();
    });
    req.on('response', function(response) {
      response.setEncoding('utf-8');
      var body = '';
      response.on('data', function(chunk) { body += chunk; });
      response.on('end', function() {
        promise.fulfill({
          mimeType: response.headers['content-type'].split(';')[0],
          data: body
        });
      });
    });

    if(body) {
      req.write(body);
    }
    req.end();
  } else {
    promise.reject("remoteStorage not fully configured!");
  }
  return promise;
};

/**
 * Function: destroy
 *
 * handles the deletion of the session data both stored in redis or cached
 * locally.
 *
 * Parameters:
 *
 *   sid - the session ID to destroy
 *
 * Returns:
 *
 *   n/a
 */
Session.prototype.destroy = function (sid) {
  var promise = promising();
  if (sid) {
    // delete the session hash from the redis DB
    client = redis.createClient();
    client.del('sockethub:session:' + sid);
    console.log(' [session] destroyed #' + sid + '.');
    var session = Session.prototype.instances[sid];
    if (session) {
      // cleanup session contents manually, so in case a reference to
      // the session keeps lingering somewhere (which it shouldn't!),
      // at least there remains no compromising information (bearerToken)
      // in memory.
      session.reset();
    }
    delete Session.prototype.instances[sid];
    promise.fulfill();
  } else {
    promise.reject("Session.prototype.destroy called without an sid");
  }
  return promise;
};

module.exports.get = get;
module.exports.destroy = Session.prototype.destroy;
