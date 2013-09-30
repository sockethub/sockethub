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

var promising = require('promising');
var http = require('http');
var https = require('https');
var url = require('url');
var redis = require('redis');
var crypto = require('crypto');
var Subsystem = require('./subsystem.js');
//var PlatformSession = require('./platform-session.js');
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
    console.error(' [session:'+sockethubId+'] unable to decrypt encrypted string. returning empty object');
    console.debug(' [session:'+sockethubId+'] encrypted string: '+encstring);
    string = '{}';
  }
  return string;
}










/******************************************************************************
 * ***************************************************************************/

//var encKey = '';

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

  if (!this.platform) {
    throw new util.SockethubError('did not receive platform name, cannot initialize');
  }
  if (!this.sockethubId) {
    throw new util.SockethubError('did not receive sockethubId, cannot initialize');
  }

  this.subsystem = Subsystem(this.platform, this.sockethubId);
  var self = this;

  this.subsystem.events.on('ping-with-callback', function (data, callback) {
    // data received from ping command
    var obj = {};
    if (data.object.encKey) {
      console.info(self.log_id + 'setting encKey');
      self.encKey = data.object.encKey;
    } else if ((data.object.requestEncKey) && (self.encKey)) {
      obj = {"encKey": self.encKey};
    } else if ((data.object.requestEncKey) && (!self.encKey)) {
      console.error(self.log_id + 'received ping request for encKey but do not possess it');
    } else {
      throw util.SockethubError(self.log_id + 'recevied ping with no encKey', true);
    }
    callback(obj);
  });

  this.subsystem.events.on('ping-response', function (data) {
    // when we receive a response to a ping, check for encKey
    if ((data.object.encKey) && (self.platform !== 'dispatcher')) {
      self.encKey = data.object.encKey;
    }
  });

  this.subsystem.events.on('cleanup', function (data) {
    if (typeof data.object.sids === 'object') {
      console.info(self.log_id + 'cleanup command received.');
      for (var key in data.object.sids) {
        self.events.emit('cleanup', data.object.sids[key]);
        SessionManager.prototype.destroy.call(self, data.object.sids[key]);
      }
    } else {
      console.info(log_id + 'cleanup command received with no sids, shutdown');
      self.events.emit('cleanup');
    }
  });
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
 *
 * Returns:
 *
 *   promise with session object
 */
SessionManager.prototype.get = function (sid) {
  var promise = promising();
  var self = this;

  console.debug(this.log_id + 'session.get(' + sid + ') called.');

  if (!sid) {
    throw Error('SessionManager.get requires an sid, none set.');
  }

  if (!this.encKey) {
    throw new util.SockethubError('encKey not set, cannot generate session object');
  }

  if (sid in SessionManager.prototype.instances) {
    console.info(' [session:' + this.platform + '] session: ' + sid +
                 ', exists locally.');
    // session lives locally, return it.
    promise.fulfill(SessionManager.prototype.instances[sid]);
    return promise;
  }

  var redis_key = 'sockethub:' + this.sockethubId + ':session:' + sid +
                  ':_internal';
  var session;

  // check redis Db for existing session entry.
  util.redis.get('get', redis_key, function (err, reply) {
    if (!reply) {
      // session does not exist. crete one.
      session = new Session(self, sid); //, redis_key);
      console.info(' [session:' + self.platform + '] created sid ' + sid +
                   '. [' + redis_key + ']');
    } else {
      // session exists, create local session object, passing reply data
      session = new Session(self, sid, reply);
      console.info(' [session:' + self.platform +
                   '] retreived from redis, creating. sid ' + sid +
                   '. [redis_key:' + redis_key + ']');
    }
    SessionManager.prototype.instances[sid] = session;
    promise.fulfill(session);
  });

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
 *   promise
 */
SessionManager.prototype.destroy = function (sid) {
  var promise = promising();
  if (sid) {
    console.debug(this.log_id + 'session destroy called on [sid: ' + sid + ']');
    // destroy this session instance
    // delete the session hash from the redis DB
    var channel = 'sockethub:' + this.sockethubId + ':session:' + sid;
    util.redis.single('del', channel);
    console.debug(' [session:' + this.platform + '] destroyed redis instances: ' + channel);
    var session = SessionManager.prototype.instances[sid];
    if (session) {
      // cleanup session contents manually, so in case a reference to
      // the session keeps lingering somewhere (which it shouldn't!),
      // at least there remains no compromising information (bearerToken)
      // in memory.
      session.cleanup();
    }

    delete SessionManager.prototype.instances[sid];
    promise.fulfill();

  } else {
    console.debug(this.log_id + 'session destroy called for all sessions');
    // destroy all sessions
    for (var key in SessionManager.prototype.instances) {
      this.destroy(key);
    }
    promise.fulfill();
  }

  return promise;
};

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
 *   a promise which is fulfilled when the document retreival is completed
 */
SessionManager.prototype.request = function (rsSettings, method, path, mimeType, body) {
  var promise = promising();

  console.debug(' [session:' + this.platform + '] request: ' + method +
                ' ' + path);

  if (rsSettings.storageInfo && rsSettings.storageInfo.href && rsSettings.bearerToken) {
    var options = url.parse(rsSettings.storageInfo.href);
    options.headers = { 'Authorization': 'Bearer ' + rsSettings.bearerToken };
    options.method = method;
    if (path.charAt(0) === '/') {
      options.path += path;
    } else {
      options.path += '/' + path;
    }

    if (mimeType) {
      options.headers['Content-Type'] = mimeType + '; charset=UTF-8';
    }

    console.debug(' [session:' + this.platform + '] https options: ' +
                  JSON.stringify(options));
    var req;
    try {
      if (options.protocol === 'http:') {
        req = http.request(options);
      } else {
        req = https.request(options);
      }
    } catch (e) {
      console.error(' [session:' + platform + '] error with request: ' + e);
      promise.reject();
      return false;
    }

    req.on('error', function (e) {
      console.error(' [session:' + platform + '] request caught error: ' + e);
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

    if (body) {
      req.write(body);
    }
    req.end();
  } else {
    promise.reject("remoteStorage not fully configured!");
  }
  return promise;
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
  var promise = promising();
  if (this.redis_key === '') {
    promise.reject('internal error, redis_key not set!');
    return promise;
  }
  // store _config in redis hash ...
  var client = redis.createClient();
  console.debug(this.log_id + ' [session:' + platform + ':' + this.sid +
               '] setting config with key: ' + this.redis_key + platform +
               ' field: ' + name);
  var self = this;
  client.hget(this.redis_key + platform, name, function (err, reply) {
    var obj;
    if (!reply) {
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
    client.hset(self.redis_key + platform, name, obj, function (err, replies) {
      client.quit();
      promise.fulfill();
    });
  });

  // FIXME
  // we'll also need to have the redis session data cleared out when
  // a session is closed.
  // if we store by secret, then how will we know when to clear out a
  // redis hash for that secret? -- currently we store by secret:sid so
  // we don't have to cross that bridge yet.
  return promise;
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
  var promise = promising();
  if (this.redis_key === '') {
    promise.reject('internal error, redis_key not set!');
    return promise;
  }

  if (refresh) {
    console.warn('session.getConfig called with refresh=true, this isnt currently supported. setting false');
    refresh = false;
  }

  if (!refresh) { // get from redis
    var client = redis.createClient();
    console.debug(' [session:' + platform + ':' + this.sid +
                  '] getting config with key: ' + this.redis_key + platform +
                  ' field: ' + name);
    var self = this;
    client.hget(this.redis_key + platform, name, function (err, reply) {
      if (!reply) {
        promise.reject('could not get ' + name);
      } else {
        var obj = JSON.parse(decrypt(self.enc_key, reply));
        client.quit();
        promise.fulfill(obj);
      }
    });
  } else {
    promise.fulfill({});
  }

  return promise;
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
 *   platform - name of platform (text string)
 *   sid      - sessionId (a sessionId is issued for each websocket connection)
 *
 */
function Session(parent, sid) {
  SessionManager.call(this, {
    sockethubId: parent.sockethubId,
    platform: parent.platform,
    encKey: parent.encKey
  });
  console.debug(this.log_id + 'Session constructor called for sid: ' + sid); //, parent);

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
}

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
  console.info(' [session:' + this.platform + '] sending message on channel ' +
                  send_channel + " - platform: " + p.platform + ' verb: ' +
                  p.verb + ' status: ' + p.status);
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
  console.info(' [session:' + this.platform + '] cleaning up');
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
  var promise = promising();
  var self = this;

  if (platform in this.platforms) {
    // session lives locally, return it.
    console.debug(' [session:' + platform + '] retreived platform session locally.');
    promise.fulfill(this.platforms[platform]);
  } else {
    var psession;
    // check redis DB for existing session entry.
    util.redis.get('get', this.redis_key + platform, function (err, reply) {
      if (!reply) {
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
Session.prototype.getFile = function (module, path) {
  var promise = promising();
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
          promise.fulfill('remotestorage', resource);
        });
      } else {
        // FIXME: implement _.getFS()
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
  var promise = promising();
  var self = this;
  this.getConfig('remoteStorage').then(function (rsConfig) {
    if(! rsConfig) {
      promise.reject("Not configured yet!!!");
    } else {
      //console.log('rsConfig:',rsConfig);
      return self.request(rsConfig, 'GET', module + '/' + path).
        then(function(response) {
          if (response.mimeType === 'application/json') {
            promise.fulfill(JSON.parse(response.data));
          } else {
            promise.fulfill(response);
          }
        });
    }
  });
  return promise;
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
   * the platform session object can also contain helper functions (like the
   * promising library) to be helpful to the platform developer
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
      throw Error('no platform name specified to PlatformSession');
    }
    if (!p.sockethubId) {
      throw Error('no sockethub ID passed to PlatformSession');
    }
    if (!p.sid) {
      throw Error('no session ID passed to PlatformSession');
    }
    if (!p.redis_key) {
      throw Error('no redis_key passed to PlatformSession');
    }
    if (!p.enc_key) {
      console.log('PARAMS: ',p);
      throw Error('no enc_key passed to PlatformSession');
    }
    this.platform = p.platform;
    this.sockethubId = p.sockethubId;
    this.sid = p.sid;
    this.redis_key = p.redis_key;
    this.log_id = ' [platform:' + this.platform + '] ';
    enc_key = p.enc_key;

    this.clientManager = require('./client-manager.js')(this.platform, this.sid);
  }

  PlatformSession.prototype.promising = promising;

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

  PlatformSession.prototype.log = function (msg, dump) {
    //console.debug('platform: ',platform);
    if (dump) {
      console.info(' [platform:' + this.platform + '] ' + msg, dump);
    } else {
      console.info(' [platform:' + this.platform + '] ' + msg);
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