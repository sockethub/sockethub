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
var url = require('url');
var redis = require('redis');


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
    config: {
      '_internal': {}
    },
    platforms: {},  // platforms used by this session
    registered: false
  };
  redis_key = 'sockethub:session:'+sid; // needs ':<platform>' (or _internal) appended

  // internal function, only exposed with a curry for platform name.
  function setConfig(platform, name, _config) {
    _.config[platform][name] = _config;
  }

  function getConfig(platform, name) {
    var promise = promising();
    if (_.config[platform] === undefined) {
      promise.fulfill({}); // XXX TODO: check the redis store?
    }
    if (_.config[platform][name] !== undefined) {
      promise.fulfill(_.config[platform][name]);
    } else {
      var client = redis.createClient();
      client.hget(redis_key+':'+platform, name, function(err, reply) {
        // TODO FIXME XXX: process reply and stick it in the local config var
        promise.fulfill(reply);
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
    console.log(' [session] Send message on channel ' + channel);
    client.rpush(channel, JSON.stringify(p));
  }
  pub.send = send;

  // Reset the session.
  pub.reset = function() {
    _.config = {
      _internal: {}
    };
    _.platforms = {};
    _.registered = false;
  };

  pub.register = function () {
    _.registered = true;
  };
  pub.unregister = function () {
    _.registered = false;
  };
  pub.isRegistered = function () {
    return _.registered;
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
        p.status = true;
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

    return ppub;
  }

  pub.getPlatformSession = function (platform) {
    var promise = promising();

    if (platform in _.platforms) {
      // session lives locally, return it.
      console.log(' [session] retreived locally, platform session for ' + platform + '.');
      promise.fulfill(_.platforms[platform]);
    }

    var client = redis.createClient();
    var psession;
    _.config[platform] = {};

    // check redis Db for existing session entry.
    client.get(redis_key+':'+platform, function (err, reply) {
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

    return promise;
  };

  // Get a file from remoteStorage.
  //
  // Example:
  //   // will GET {storageRoot}/messages/.xmpp and (if applicable)
  //   // parse it's content as JSON.
  //   session.get('messages', '.xmpp')
  //
  // Returns:
  //   Either the parsed JSON object (if Content-Type: application/json), or
  //   an object of the form { mimeType: '...', data: '...' }.
  pub.rsGet = function (module, path) {
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
  var promise = promising();
  if(rsSettings.storageInfo && rsSettings.storageInfo.href && rsSettings.bearerToken) {
    var options = url.parse(rsSettings.storageInfo.href);
    options.headers = { 'Authorization': 'Bearer ' + rsSettings.bearerToken };
    options.method = method;
    options.path += '/' + path;

    if(mimeType) {
      options.headers['Content-Type'] = mimeType + '; charset=UTF-8';
    }

    var req = http.request(options);

    req.on('error', promise.reject);
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
