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
var PlatformSession = require('./platform-session.js');
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

var encKey = '';

/**
 * Function: SessionManager
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
 * Returns:
 *
 *   return description
 */
var SessionManager = function (p) {
  this.platform = p.platform || undefined;
  this.sockethubId = p.sockethubId || undefined;
  encKey = (encKey) ? encKey : p.encKey || undefined;
  this.events = new EventEmitter();
  this.log_id = ' [session:' + this.platform + '] ';

  if (!this.platform) {
    throw new util.SockethubError('did not receive platform name, cannot initialize');
  }
  if (!this.sockethubId) {
    throw new util.SockethubError('did not receive sockethubId, cannot initialize');
  }

  this.subsystem = Subsystem(this.platform, this.sockethubId);

  this.subsystem.events.on('ping-with-callback', function (data, callback) {
    // data received from ping command
    var obj = {};
    if (data.object.encKey) {
      console.info(this.log_id + 'setting encKey');
      encKey = data.object.encKey;
    } else if ((data.object.requestEncKey) && (encKey)) {
      obj = {"encKey": encKey};
    } else if ((data.object.requestEncKey) && (!encKey)) {
      console.error(this.log_id + 'received ping request for encKey but do not possess it');
    } else {
      throw util.SockethubError(this.log_id + 'recevied ping with no encKey', true);
    }
    callback(obj);
  });

  this.subsystem.events.on('ping-response', function (data) {
    // when we receive a response to a ping, check for encKey
    if ((data.object.encKey) && (this.platform !== 'dispatcher')) {
      encKey = data.object.encKey;
    }
  });

  this.subsystem.events.on('cleanup', function (data) {
    if (typeof data.object.sids === 'object') {
      console.info(this.log_id + 'cleanup command received.');
      for (var key in data.object.sids) {
        events.emit('cleanup', data.object.sids[key]);
        this.destroy(data.object.sids[key]);
      }
    } else {
      console.info(log_id + 'cleanup command received with no sids, shutdown');
      events.emit('cleanup');
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
 *   return boolean
 */
SessionManager.prototype.encKeySet = function () {
  return (encKey) ? true : false;
};

/**
 * Function: getAllSessionIDs
 *
 * returns a list of all sessionIds (keys of instances class variable)
 *
 * Returns:
 *
 *   return array of sessionIds
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
  console.debug(this.log_id + ' session.get(' + sid + ') called.');

  if (!encKey) {
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
      console.info(' [session:' + this.platform + '] created sid ' + sid +
                   '. [' + redis_key + ']');
    } else {
      // session exists, create local session object, passing reply data
      session = new Session(self, sid, reply);
      console.info(' [session:' + this.platform +
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
  console.debug(this.log_id + 'session (pub) destroy called on [sid: ' + sid + ']');

  if (sid) {
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
    // FIXME - splice the array instead of delete to ensure it's removed and
    // avoid memory leaks
    delete SessionManager.prototype.instances[sid];
    promise.fulfill();

  } else {
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
 *   returns a promise which is fulfilled when the document retreival is completed
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

    console.debug(' [session:' + platform + '] https options: ' + JSON.stringify(options));
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
 *   return promise
 */
SessionManager.prototype._setConfig = function (platform, name, _config) {
  var promise = promising();
  if (this.redis_key === '') {
    promise.reject('internal error, redis_key not set!');
    return promise;
  }
  // store _config in redis hash ...
  var client = redis.createClient();
  console.info(' [session:' + platform + ':' + this.sid +
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
 *   return promise with data as first param
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


function Session(parent, sid) {
  console.debug('Session constructor called for sid: ' + sid, parent);

  SessionManager.call(this, {
    sockethubId: parent.sockethubId,
    platform: parent.platform
  });

  console.debug(this.log_id + ' Session constructor initializing');

  this.platforms = {};  // platforms used by this session
  this.registered = false;
  this.secret = '';
  this.sid = sid;

  // FIXME - we keep encKey private, but then expose it again with this.enc_key...
  this.enc_key = encKey + sid;

  // redis_key - needs <platform> or '_internal' appended
  this.redis_key = 'sockethub:' + this.sockethubId + ':session:' + this.sid + ':';
}


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


Session.prototype.unregister = function () {
  this.registered = false;
};


Session.prototype.isRegistered = function () {
  return this.registered;
};


Session.prototype.getSecret = function() {
  return this.secret;
};


Session.prototype.getSessionID = function() {
  return this.sid;
};


Session.prototype.isRedisKeySet = function () {
  return (this.redis_key) ? true : false;
};


// Get a list of all platforms used by this session so far.
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
Session.send = function (p) {
  var send_channel = 'sockethub:' + this.sockethubId + ':dispatcher:outgoing:' +
                     this.sid;
  //console.debug(' [session] send object: ',p);
  var json_msg = JSON.stringify(p);
  console.info(' [session:' + this.platform + '] sending message on channel ' +
                  send_channel + " - platform: " + p.platform + ' verb: ' +
                  p.verb + ' status: ' + p.status);
  util.redis.set('rpush', send_channel, json_msg);
};






// clears any existing data from redis, just in case.
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






// Reset the session.
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
    console.debug('session.responseHandler called with object: ', p);
    self.send(p);
  };
};






Session.prototype.getPlatformSession = function (platform) {
  var promise = promising();

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
        psession = new PlatformSession(platform, this.sid);
        console.debug(' [session:' + platform +
                      '] created platform session. [redis_key:' +
                      this.redis_key + platform+']');
      } else {
        // session exists, create local session object, passing reply data
        psession = new PlatformSession(platform, this.sid, reply);
        console.debug(' [session:' + platform + '] retreived from redis, platform session.');
      }
      this.platforms[platform] = psession;
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
        this.getRS(module, path).then(function (resource) {
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
Session.prototype.getRS = function (module, path) {
  var promise = promising();
  this.getConfig('remoteStorage').then(function (rsConfig) {
    if(! rsConfig) {
      promise.reject("Not configured yet!!!");
    } else {
      //console.log('rsConfig:',rsConfig);
      return SessionManager.request(rsConfig, 'GET', module + '/' + path).
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











module.exports = function (p) {
  return new SessionManager(p);
};