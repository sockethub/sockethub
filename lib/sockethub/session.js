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

var Q = require('q');
var http = require('http');
var https = require('https');
var url = require('url');
var redis = require('redis');
var crypto = require('crypto');
var Subsystem = require('./subsystem.js');
var EventEmitter = require('events').EventEmitter;
var util = require('./util.js');



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

function encrypt(key, string) {
  var cipher = crypto.createCipher("aes192", key),
        msg = [];

  msg.push(cipher.update(string, "binary", "hex"));
  msg.push(cipher.final("hex"));
  return msg.join("");
}

function decrypt(key, encstring) {
  var string = '{}';
  try {
    var decipher = crypto.createDecipher("aes192", key),
        msg = [];

    msg.push(decipher.update(encstring, "hex", "binary"));
    msg.push(decipher.final("binary"));
    string = msg.join("");
  } catch (e) {
    console.error(' [session] unable to decrypt encrypted string. returning empty object');
    //console.debug(' [session] encrypted string: '+encstring);
    string = '{}';
  }
  return string;
}










/******************************************************************************
 * ***************************************************************************/

/**
 * Constructor: SessionManager
 *
 * Manages the issuing of new sessions instances (each websocket connection
 * gets it's own instance)
 *
 * Parameters:
 *
 *  an object containing the following properties:
 *  {
 *    platform - name of platform (text string)
 *
 *    sockethubId - ID created by sockethub at startup
 *
 *    encKey (optional) - this is generally set via a redis handshake,
 *                        however for testing purposes (and in the case of the
 *                        dispatcher, who creates the encKey before initializing
 *                        the Session Manager) it's also allowed to set this on
 *                        object instantiation.
 *  }
 *
 */
var SessionManager = function (p) {
  this.platform = p.platform || undefined;
  this.sockethubId = p.sockethubId || undefined;
  this.encKey = p.encKey || '';
  this.log_id = ' [session:' + this.platform + '] ';
  this.events = new EventEmitter();
  var extend = p.extend || false;

  if (!this.platform) {
    throw new Error('did not receive platform name, cannot initialize');
  }
  if (!this.sockethubId) {
    throw new Error('did not receive sockethubId, cannot initialize');
  }

  if (!extend) {
    // when we're extending the class, we don't want to re-initialize the
    // subsystem and listeners
    this.subsystem = Subsystem(this.platform, this.sockethubId);
    this.setListeners();
  }
};

/**
 * Variable: SessionManager.prototype
 *
 * SessionManager functions
 */
SessionManager.prototype = {
  constructor: SessionManager,
  instances: {}
};

/**
 * Variable: instances
 *
 * Class variable index of all Session instances created.
 * sessionId is the key, value is the session object.
 */
SessionManager.prototype.instances = {};

SessionManager.prototype.setListeners = function () {
  var self = this;
  var listeners = {};
  listeners['ping-with-callback'] = function (data, callback) {
    // data received from ping command
    var obj = {};
    if (data.object.encKey) {
      console.debug(self.log_id + 'setting encKey');
      self.encKey = data.object.encKey;
    } else if ((data.object.requestEncKey) && (self.encKey)) {
      obj = {"encKey": self.encKey};
    } else if ((data.object.requestEncKey) && (!self.encKey)) {
      console.error(self.log_id + 'received ping request for encKey but do not possess it');
    } else {
      throw new Error(self.log_id + 'recevied ping with no encKey', true);
    }
    callback(obj);
  };
  this.subsystem.events.on('ping-with-callback', listeners['ping-with-callback']);

  listeners['ping-response'] = function (data) {
    // when we receive a response to a ping, check for encKey
    if ((data.object.encKey) && (self.platform !== 'dispatcher')) {
      self.encKey = data.object.encKey;
    }
  };
  this.subsystem.events.on('ping-response', listeners['ping-response']);

  listeners.cleanup = function (data) {
    //self.subsystem.events.removeAllListeners();
    var key;
    if (typeof data.object.sids === 'object') {
      //console.debug(self.log_id + 'cleanup command received.');
      for (key in data.object.sids) {
        self.events.emit('cleanup', data.object.sids[key]);
        self.destroy(data.object.sids[key]);
      }
    } else {
      console.info(self.log_id + ' emitting cleanup event');
      self.events.emit('cleanup');
    }
  };
  this.subsystem.events.on('cleanup', listeners.cleanup);
};

/**
 * Function: encKeySet
 *
 * boolean function to check if encKey has been set
 *
 * Returns:
 *
 *   boolean
 */
SessionManager.prototype.encKeySet = function () {
  return (this.encKey) ? true : false;
};

/**
 * Function: clearEncKey
 *
 * function to delete the encryption key
 *
 */
SessionManager.prototype.clearEncKey = function () {
  this.encKey = '';
};

/**
 * Function: getAllSessionIDs
 *
 * returns a list of all sessionIds (keys of instances class variable)
 *
 * Returns:
 *
 *   array of sessionIds
 */
SessionManager.prototype.getAllSessionIDs = function () {
  var sids = Object.keys(SessionManager.prototype.instances);
  console.debug(' [session:' + this.platform + '] all session IDs: ', sids);
  return sids;
};

/**
 * Function: get
 *
 * create the session instance for the given session ID.
 * - If it exists in memory, it's returned.
 * - If it exists in the redis store, it's retreived and built for a local
 *   instance.
 * - If the session doesn't exist yet, a new one will be created.
 *
 * Parameters:
 *
 *   sid - the session ID to lookup/create
 *   create - if this flag is set to false, the session will not be created
 *            if it does not already exist (defaults to true)
 *
 * Returns:
 *
 *   promise with session object
 */
SessionManager.prototype.get = function (sid, create) {
  var q = Q.defer();
  var self = this;
  create = (typeof create !== 'undefined') ? create : true;

  console.debug(this.log_id + 'session.get(' + sid + ') called.');

  if (!sid) {
    throw new Error('SessionManager.get requires an sid, none set.');
  }

  if (!this.encKey) {
    throw new Error('encKey not set, cannot generate session object');
  }
  if (sid in SessionManager.prototype.instances) {
    console.info(' [session:' + this.platform + '] session: ' + sid +
                 ', exists in local memory, using.');
    // session lives locally, return it.
    q.resolve(SessionManager.prototype.instances[sid]);
    return q.promise;
  }

  if (!create) {
    q.reject('session does not exists and create flag is false');
    return q.promise;
  }

  var redis_key = 'sockethub:' + this.sockethubId + ':session:' + sid +
                  ':_internal';
  var session;

  // check redis Db for existing session entry.
  util.redis.get('hgetall', redis_key, function (err, reply) {
    if (err) {
      q.reject(err);
    } else if (!reply) {
      // session does not exist. crete one.
      session = new Session(self, sid); //, redis_key);
      console.info(' [session:' + self.platform + '] created sid ' + sid +
                   '. [' + redis_key + ']');
    } else {
      // session exists, create local session object, passing reply data
      session = new Session(self, sid, reply);
      console.info(' [session:' + self.platform +
                   '] retreived from redis, using. sid ' + sid +
                   '. [redis_key:' + redis_key + ']');
    }
    SessionManager.prototype.instances[sid] = session;
    q.resolve(session);
  });

  return q.promise;
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
 *   promise
 */
SessionManager.prototype.destroy = function (sid) {
  var q = Q.defer();
  if (sid) {
    //console.debug(this.log_id + 'session destroy called by: ' + arguments.callee.caller.toString());
    // destroy this session instance
    // delete the session hash from the redis DB
    var channel = 'sockethub:' + this.sockethubId + ':session:' + sid;
    util.redis.single('del', channel);
    console.debug(this.log_id + 'destroyed redis key: ' + channel);
    var session = SessionManager.prototype.instances[sid];
    if (session) {
      // cleanup session contents manually, so in case a reference to
      // the session keeps lingering somewhere (which it shouldn't!),
      // at least there remains no compromising information (bearerToken)
      // in memory.
      session.cleanup();
    }

    setTimeout(function () {
      delete SessionManager.prototype.instances[sid];
      q.resolve();
    }, 3000);
  } else {
    console.debug(this.log_id + 'session destroy called for all sessions');
    // destroy all sessions
    for (var key in SessionManager.prototype.instances) {
      this.destroy(key);
    }
    q.resolve();
  }

  return q.promise;
};

/**
 * Function: request
 *
 * request a document from remoteStorage
 *
 * Parameters:
 *
 *  an object with the following properties:
 *  {
 *   rsConfig - object containing rs config
 *   method   - GET POST, etc.
 *   path     - full path of request
 *   mimeType - for writes (POST), this specifies the mimetype
 *   body     - for writes (POST), this specifies the content body
 *  }
 *
 * Returns:
 *
 *   a promise which is fulfilled when the document retreival is completed
 */
SessionManager.prototype.request = function (p) {
  var q = Q.defer();
  if ((!p.rsConfig) || (!p.method) || (!p.path)) {
    console.error(' [session:' + this.platform + '] request() incomplete params');
    q.reject("incomplete params");
    return q.promise;
  }
  console.debug(' [session:' + this.platform + '] request: ' + p.method + ' ' + p.path);

  if ((!p.rsConfig.storageInfo) || (!p.rsConfig.storageInfo.href) || (!p.rsConfig.bearerToken)) {
    q.reject("remoteStorage not fully configured!");
    return q.promise;
  }

  var options = url.parse(p.rsConfig.storageInfo.href);
  options.headers = { 'Authorization': 'Bearer ' + p.rsConfig.bearerToken };
  options.method = p.method;
  if (p.path.charAt(0) === '/') {
    options.path += p.path;
  } else {
    options.path += '/' + p.path;
  }

  if (p.mimeType) {
    options.headers['Content-Type'] = p.mimeType + '; charset=UTF-8';
  }

  console.debug(' [session:' + this.platform + '] http options: ' + JSON.stringify(options));

  function onResponse(res) {
    console.debug(' [session:' + _this.platform + '] request response ');
    // console.log('STATUS: ' + res.statusCode);
    // console.log('HEADERS: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    var body = '';
    res.on('data', function(chunk) { body += chunk; });
    res.on('end', function() {
      console.log("END");
      q.resolve({
        mimeType: res.headers['content-type'].split(';')[0],
        data: body
      });
    });
  }
  var _this = this;
  var req;
  try {
    if (options.protocol === 'http:') {
      req = http.get(options, onResponse);
    } else {
      req = https.get(options, onResponse);
    }
  } catch (e) {
    console.error(' [session:' + this.platform + '] error with request: ' + e);
    q.reject();
    return q.promise;
  }
  req.on('error', function (e) {
    console.error(' [session:' + _this.platform + '] request caught error: ' + e);
    q.reject();
  });

  req.end();
  return q.promise;
};

/**
 * Function: _setConfig
 *
 * DO NOT USE DIRECTLY
 *
 * stores data to the redis db.
 *
 * first checks to see if the key (name) is already there for this platforms
 * channel. if it is, it grabs the data, decrypts it, adds the new data, then
 * encrypts and stores it back in the redis db.
 *
 * Parameters:
 *
 *   platform - platform name (will be curry'd in the session object)
 *   name     - key to store under, ie. 'credentials'
 *   _config  - data to store
 *
 * Returns:
 *
 *   promise
 */
SessionManager.prototype._setConfig = function (platform, name, _config) {
  var q = Q.defer();
  if (this.redis_key === '') {
    q.reject('internal error, redis_key not set!');
    return q.promise;
  }
  // store _config in redis hash ...
  console.debug(this.log_id + ' [session:' + platform + ':' + this.sid +
               '] setting config with key: ' + this.redis_key + platform +
               ' field: ' + name);
  var self = this;
  util.redis.get('hget', this.redis_key + platform, name, function (err, reply) {
    var obj;
    if (err) {
      console.error('session.getConfig error ',err);
      q.reject(err);
    } else if (!reply) {
      obj = encrypt(self.enc_key, JSON.stringify(_config));
    } else {
      obj = encrypt(self.enc_key,
                JSON.stringify(
                    mergeObjects(
                        JSON.parse(decrypt(self.enc_key, reply)),
                        _config
                    )
                )
            );
    }
    util.redis.set('hset', self.redis_key + platform, name, obj, function (err, replies) {
      if (err) {
        console.error('session.getConfig error ',err);
        q.reject(err);
      } else {
        q.resolve();
      }
    });
  });

  return q.promise;
};

/**
 * Function: _getConfig
 *
 * DO NOT USE DIRECTLY
 *
 * fetches redis data based on platform and key name. decrypts and sends the
 * desired data in a promise.
 *
 * Parameters:
 *
 *   platform - platform name (will be curry'd in the session object)
 *   name     - key to fetch, ie. 'credentials'
 *   refresh  - CURRENTLY NOT IMPLEMENTED
 *
 * Returns:
 *
 *   promise with data as first param
 */
SessionManager.prototype._getConfig = function (platform, name, refresh) {
  var q = Q.defer();
  if (this.redis_key === '') {
    q.reject('internal error, redis_key not set!');
    return q.promise;
  }

  if (refresh) {
    console.warn('session.getConfig called with refresh=true, this isnt currently supported. setting false');
    refresh = false;
  }

  if (!refresh) { // get from redis
    console.debug(' [session:' + platform + ':' + this.sid +
                  '] getting config with key: ' + this.redis_key + platform +
                  ' field: ' + name);
    var self = this;
    util.redis.get('hget', this.redis_key + platform, name, function (err, reply) {
      if (err) {
        console.error('session.getConfig error ',err);
        q.reject(err);
      } else if (!reply) {
        q.reject('could not get ' + name);
      } else {
        var obj = JSON.parse(decrypt(self.enc_key, reply));
        q.resolve(obj);
      }
    });
  } else {
    q.resolve({});
  }

  return q.promise;
};








































/******************************************************************************
 * ***************************************************************************/

/**
 * Constructor: Session
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
  util.redis.set('rpush', send_channel, json_msg);
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
    util.redis.single('del', this.redis_key + platforms[i]);
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
  console.info(' [session:' + this.platform + '] cleaning up session '+this.sid);
  this._purgeConfig();
  setTimeout(function () {
    this.platforms = {};
    this.secret = {};
    this.registered = false;
    this.redis_key = '';
    this.sid = '';
  });
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
  } else {
    var psession;
    // check redis DB for existing session entry.
    util.redis.get('hgetall', this.redis_key + platform, function (err, reply) {
      if ((err) || (!reply)) {
        // session does not exist. crete one.
        psession = new PlatformSessionWrapper({platform: platform,
                                        sockethubId: self.sockethubId,
                                        sid: self.sid,
                                        redis_key: self.redis_key,
                                        enc_key: self.enc_key});
        console.debug(' [session:' + self.platform +
                      '] created platform session. [redis_key:' +
                      self.redis_key + self.platform+']');
      } else {
        // session exists, create local session object, passing reply data
        psession = new PlatformSessionWrapper({platform: platform,
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
  }
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

  this.getConfig('remoteStorage').then(function (rsConfig) {
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
  }, function (err) {
    q.reject(err);
  });
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
  this.getConfig('remoteStorage').then(function (rsConfig) {
    if(! rsConfig) {
      q.reject("Not configured yet!!!");
    } else {
      //console.log('rsConfig:',rsConfig);
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































/******************************************************************************
 * ***************************************************************************/

/**
 * this wrapper servers as a closure to keep the enc_key from being accessed
 * via instances of this object (platforms should not be able to get the
 * enc_key)
 */
var PlatformSessionWrapper = (function () {
  var enc_key;

  /**
   * Constructor: PlatformSession
   *
   * the PlatformSession objects (or psession) are small subsets of the Session
   * objects and are passed to platforms during platform.init().
   *
   * the contain a number of methods that make communicating with the client
   * easy, and abstract away as much sockethub internals as possible.
   *
   * Parameters:
   *
   *  an object containing the following properties:
   *  {
   *    platform - name of platform (text string)
   *
   *    sockethubId - ID created by sockethub at startup
   *
   *    sid - session ID issued during websocket connect
   *
   *    redis_key - the redis key string for this platform
   *
   *    enc_key - used for redis data storing, kept in a closure and not
   *              exposed to platform
   *  }
   *
   */
  function PlatformSession(p) {
    if (!p.platform) {
      throw new Error('no platform name specified to PlatformSession');
    }
    if (!p.sockethubId) {
      throw new Error('no sockethub ID passed to PlatformSession');
    }
    if (!p.sid) {
      throw new Error('no session ID passed to PlatformSession');
    }
    if (!p.redis_key) {
      throw new Error('no redis_key passed to PlatformSession');
    }
    if (!p.enc_key) {
      //console.log('PARAMS: ',p);
      throw new Error('no enc_key passed to PlatformSession');
    }
    this.platform = p.platform;
    this.sockethubId = p.sockethubId;
    this.sid = p.sid;
    this.redis_key = p.redis_key;
    this.log_id = ' [platform:' + this.platform + '] ';
    enc_key = p.enc_key;

    this.clientManager = require('./client-manager.js')(this.platform, this.sid);
  }

  PlatformSession.prototype.getSessionID = function () {
    return this.sid;
  };

  PlatformSession.prototype.send = function (p) {
    p.platform = this.platform;
    if (!p.verb) {
      console.error('psession.send() received no verb');
      p.verb = "unknown";
    } else if (!p.actor) {
      console.error('psession.send() received no actor');
      p.actor = {"address": "unknown"};
    } else if (!p.target) {
      console.error('psession.send() received no target [' + p.target + ':' +
                    typeof p.target + ']');
      p.target = [{"address": "unknown"}];
    } else if (!p.object) {
      console.debug('psession.send() received no object');
      p.object = {};
    }
    //else if (!p.status) { console.error('psession.send() received no status'); }

    //|| (p.rid) || (!p.target) || (!p.object)) {
    //  throw "recevied invalid object to send to client, missing basic set of properties";
    //}
    Session.prototype.send.call(this, p);
  };

  PlatformSession.prototype.info = function (msg, dump) {
    //console.debug('platform: ',platform);
    if (dump) {
      console.info(' [platform:' + this.platform + '] ' + msg, dump);
    } else {
      console.info(' [platform:' + this.platform + '] ' + msg);
    }
  };
  PlatformSession.prototype.log = PlatformSession.prototype.info;

  PlatformSession.prototype.debug = function (msg, dump) {
    //console.debug('platform: ',platform);
    if (dump) {
      console.debug(' [platform:' + this.platform + '] ' + msg, dump);
    } else {
      console.debug(' [platform:' + this.platform + '] ' + msg);
    }
  };

  PlatformSession.prototype.warn = function (msg, dump) {
    //console.debug('platform: ',platform);
    if (dump) {
      console.warn(' [platform:' + this.platform + '] ' + msg, dump);
    } else {
      console.warn(' [platform:' + this.platform + '] ' + msg);
    }
  };

  PlatformSession.prototype.error = function (msg, dump) {
    //console.debug('platform: ',platform);
    if (dump) {
      console.error(' [platform:' + this.platform + '] ' + msg, dump);
    } else {
      console.error(' [platform:' + this.platform + '] ' + msg);
    }
  };

  PlatformSession.prototype.setConfig = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(this.platform);
    var self = this;
    self.enc_key = enc_key;
    return SessionManager.prototype._setConfig.apply(self, args);
  };

  PlatformSession.prototype.getConfig = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(this.platform);
    var self = this;
    self.enc_key = enc_key;
    return SessionManager.prototype._getConfig.apply(self, args);
  };

  return PlatformSession;
})();


module.exports = function (p) {
  return new SessionManager(p);
};