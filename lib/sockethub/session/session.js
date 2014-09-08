var Q               = require('q');
var path            = require('path');
var SessionManager  = require('./../session-manager.js');
var PlatformSession = require('./platform.js');
var redisPool       = require('redis-connection-pool')('sockethubRedisPool', {
  MAX_CLIENTS: 30
});

var filename        = path.basename(module.parent.filename);
var dir             = path.dirname(module.parent.filename);
var parent_dir      = path.basename(dir);


if (((filename !== 'session-manager.js') && (filename !=='platform.js')) ||
    ((parent_dir !== 'sockethub') && (parent_dir !== 'session')) ||
    ((dir + '/session/session.js' !== module.id) &&
     (dir + '/session.js' !== module.id))) {
  throw new Error('session/session.js module has been required from unexpected source, cannot continue.');
}

 /**
 * Class: Session
 *
 * Constructor for the Session object. Each session object is issued via the
 * SessionManager's get function. So an external user of the session module will
 * not use this constructor directly.
 *
 * Session objects are used by listeners and dispatchers. Not by the platforms
 * themselves (those are PlatformSession objects, defined further down this
 * file).
 *
 * Parameters:
 *
 *   sid      - sessionId (a sessionId is issued for each websocket connection)
 *
 */
var Session = function (parent, sid) {
  SessionManager.call(this, {
    sockethubId: parent.sockethubId,
    platform: parent.platform,
    encKey: parent.encKey,
    extend: true
  });
  //console.debug(this.log_id + 'Session constructor called for sid: ' + sid); //, parent);

  this.platforms = {};  // platforms used by this session
  this.registered = false;
  this.secret = '';
  this.sid = sid;

  // FIXME - we keep encKey private (we don't anymore, it's also public but the
  // platform instance does not contain these objects in it's prototype chain),
  // but then expose it again with this.enc_key...
  this.enc_key = parent.encKey + sid;

  // redis_key - needs <platform> or '_internal' appended
  this.redis_key = 'sockethub:' + this.sockethubId + ':session:' + this.sid + ':';
};

Session.prototype.request = SessionManager.prototype.request;

Session.prototype.register = function (secret) {
  console.info(' [session:' + this.platform + '] registering sid:' + this.sid);
  if (secret) {
    this.secret = secret;
    this.registered = true;
    this._purgeConfig('_internal');
    return true;
  } else {
    // must have the secret passed during register
    return false;
  }
};

/**
 * Function: unregister
 *
 * unregisters the session
 *
 */
Session.prototype.unregister = function () {
  this.registered = false;
};

/**
 * Function: isRegistered
 *
 * boolean function to check registered state of session
 *
 * Returns:
 *
 *   boolean
 */
Session.prototype.isRegistered = function () {
  return this.registered;
};

/**
 * Function: getSecret
 *
 * returns secret that this session was registered with
 *
 * Returns:
 *
 *   secret (string)
 */
Session.prototype.getSecret = function() {
  return this.secret;
};

/**
 * Function: getSessionID
 *
 * returns sessionId of session
 *
 * Returns:
 *
 *   sessionId (string)
 */
Session.prototype.getSessionID = function() {
  return this.sid;
};

/**
 * Function: isRedisKeySet
 *
 * boolean function to check if redis key is set
 *
 * Returns:
 *
 *   boolean
 */
Session.prototype.isRedisKeySet = function () {
  return (this.redis_key) ? true : false;
};

/**
 * Function: getPlatforms
 *
 * Get a list of all platforms used by this session so far.
 *
 * Returns:
 *
 *   array of platform names (array of strings)
 */
Session.prototype.getPlatforms = function() {
  return Object.keys(this.platforms);
};


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
Session.prototype.setConfig = function () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('_internal');
  return SessionManager.prototype._setConfig.apply(this, args);
};


// get the config for the specified data branch. first check local memory
// then, if not there, get from redis.
Session.prototype.getConfig = function () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('_internal');
  return SessionManager.prototype._getConfig.apply(this, args);
};


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
Session.prototype.send = function (p) {
  var send_channel = 'sockethub:' + this.sockethubId + ':dispatcher:outgoing:' +
                     this.sid;
  //console.debug(' [session] send object: ',p);
  var json_msg = JSON.stringify(p);
  console.info(' [session:' + this.platform + '] sending on chan:' +
                  send_channel + " " + p.platform + ':' +
                  p.verb + ':' + p.status);
  redisPool.rpush(send_channel, json_msg);
};

/**
 * Function: _purgeConfig
 *
 * DO NOT CALL DIRECTLY
 *
 * internal function to purge existing data from redis (matching this specific
 * index string). done during register and also during cleanup.
 *
 * Parameters:
 *
 *   platform - platform name (string)
 *
 */
Session.prototype._purgeConfig = function (platform) {
  var platforms;
  if (platform) {
    platforms = [platform];
  } else {
    platforms = this.getPlatforms();
    platforms.push('_internal');
  }

  for (var i = 0, num = platforms.length; i < num; i = i + 1) {
    redisPool.del(this.redis_key + platforms[i]);
  }
};

/**
 * Function: cleanup
 *
 * When the session object is being destroyed, we want to cleanup any interal
 * vars first.
 *
 * Parameters:
 *
 *   none
 *
 */
Session.prototype.cleanup = function() {
  var q = Q.defer();
  console.info(' [session:' + this.platform + '] cleaning up session '+this.sid);
  this._purgeConfig();
  setTimeout(function () {
    this.platforms = {};
    this.secret = {};
    this.registered = false;
    this.redis_key = '';
    this.sid = '';
    q.resolve();
  }, 0);
  return q.promise;
};

/**
 * Function: getResponseHandler
 *
 * when the listener receives a job to send to the platform module, it needs
 * to have an simplified way to report the status of the job. This function is
 * called by the listener, and returns a function which handles all the details
 * of sending a response back to the client.
 *
 * Parameters:
 *
 *   job - the job object received by the listener from the redis queue
 *
 * Returns:
 *
 *   a function which handles sending the response back to the client.
 *   it takes 3 parameters:
 *       errMsg - text string of any error, null if none
 *       status - boolean true or false
 *       object - anything to be placed in the responses 'object' property
 *
 */
Session.prototype.getResponseHandler = function (job) {
  var self = this;
  var p = {
    actor: job.actor,
    platform: job.platform,
    verb: job.verb,
    rid: job.rid
  };
  if (job.target) {
    p.target = job.target;
  }

  return function (errMsg, status, object) {
    if (errMsg) {
      p.message = errMsg;
    }
    p.status = status;
    if (object) {
      p.object = object;
    }
    //console.debug('session.responseHandler called with object: ', p);
    var log_msg = self.log_id + 'session.responseHandler called with result: [' +
                    p.verb + ':' + p.status + ']';
    if (p.message) {
      log_msg = log_msg + ' message: ' + p.message;
    }

    console.debug(log_msg);

    self.send(p);
  };
};

/**
 * Function: getPlatformSession
 *
 * when a listener initializes a platform, it must send it a 'session' object.
 * this object is *actually* a 'platform session' object, and not the session
 * object that the listener, itself uses (where this function lives).
 *
 * so the listener, using it's session object, calls session.getPlatformSession
 * and receives a platform session (or psession) which it then sends to the
 * platform during the init() call.
 *
 *
 * Parameters:
 *
 *   platform - platform name (string)
 *
 * Returns:
 *
 *   promise where, upon succes, calls back with a psession object as the first
 *   param.
 *
 */
Session.prototype.getPlatformSession = function (platform) {
  var q = Q.defer();
  var self = this;

  if (platform in this.platforms) {
    // session lives locally, return it.
    console.debug(' [session:' + platform + '] retreived platform session locally.');
    q.resolve(this.platforms[platform]);
    return q.promise;
  }

  // check redis DB for existing session entry.
  redisPool.hgetall(this.redis_key + platform, function (err, reply) {
    var psession;
    if ((err) || (!reply)) {
      // session does not exist. crete one.
      psession = new PlatformSession({platform: platform,
                                      sockethubId: self.sockethubId,
                                      sid: self.sid,
                                      redis_key: self.redis_key,
                                      enc_key: self.enc_key});
      console.debug(' [session:' + self.platform +
                    '] created platform session. [redis_key: ' +
                    self.redis_key + self.platform+']');
    } else {
      // session exists, create local session object, passing reply data
      psession = new PlatformSession({platform: platform,
                                      sockethubId: self.sockethubId,
                                      sid: self.sid,
                                      redis_key: self.redis_key,
                                      enc_key: self.enc_key,
                                      data: reply});
      console.debug(' [session:' + self.platform +
                    '] retreived from redis, platform session.');
    }
    self.platforms[platform] = psession;
    q.resolve(psession);
  });

  return q.promise;
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
 *   returns a promise, which can fulfill an array with two elements: [source, resource]
 *     source - the place the resource was retreived from,
 *              'remotestorage' 'filesystem'
 *     resource - the JSON object (in some cases could be a directory listing)
 */
Session.prototype.getFile = function (module, path) {
  var q = Q.defer();
  var self = this;

  this.getConfig('remoteStorage', 'default').then(function (rsConfig) {
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
        self.getRS(module, path).then(function (resource) {
          q.resolve(['remotestorage', resource]);
        }, q.reject);
      } else {
        // FIXME: implement _.getFS()
        q.reject('unable to retreive resource from your remote storage: ' + module + ' ' + path);
      }
    } else {
      q.reject('no scope defined');
    }
  }, q.reject).fail(q.reject);
  return q.promise;
};

/**
 * Function: getRS
 *
 * Get a file from remoteStorage.
 *
 * Example:
 *
 *   // will GET {storageRoot}/messages/.xmpp and (if applicable)
 *   // parse it's content as JSON.
 *   rgetRS('sockethub', 'credentials/email')
 *
 * Parameters:
 *
 *   module - name of remoteStorage module (string)
 *   path   - path relative to module (string)
 *
 * Returns:
 *
 *   return promise containing data (if successful)
 */
Session.prototype.getRS = function (module, path) {
  var q = Q.defer();
  var self = this;
  this.getConfig('remoteStorage', 'default').then(function (rsConfig) {
    if(! rsConfig) {
      q.reject("Not configured yet!!!");
    } else {
      return self.request({
        rsConfig: rsConfig,
        method: 'GET',
        path: module + '/' + path
      }).then(function(response) {
        console.debug('session.getRS response: ', response);
        if (response.mimeType === 'application/json') {
          q.resolve(JSON.parse(response.data));
        } else {
          q.resolve(response);
        }
      }, q.reject);
    }
  });
  return q.promise;
};


module.exports = Session;