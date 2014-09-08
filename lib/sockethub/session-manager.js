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
var Q               = require('q');
var crypto          = require('crypto');
var Subsystem       = require('./subsystem.js');
var RemoteStorage   = require('./remotestorage.js');
var EventEmitter    = require('events').EventEmitter;
var redisPool       = require('redis-connection-pool')('sockethubRedisPool', {
  MAX_CLIENTS: 30
});


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
    string = '{}';
  }
  return string;
}





/******************************************************************************
 * ***************************************************************************/

/**
 * Class: SessionManager
 *
 * Manages the issuing of new sessions instances (each websocket connection
 * gets it's own instance)
 *
 * Parameters:
 *
 *  An *object* containing the following properties.
 *
 *    platform - name of platform (text string)
 *
 *    sockethubId - ID created by sockethub at startup
 *
 *    encKey (optional) - this is generally set via a redis handshake,
 *                        however for testing purposes (and in the case of the
 *                        dispatcher, who creates the encKey before initializing
 *                        the Session Manager) it's also allowed to set this on
 *                        object instantiation.
 *
 */
function SessionManager(p) {
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
}

SessionManager.prototype = {
  constructor: SessionManager
};

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
        if (data.object.sids[key]) {
          self.events.emit('cleanup', data.object.sids[key]);
          self.destroy(data.object.sids[key]);
        }
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
 * Variable: instances
 *
 * Class variable index of all Session instances created.
 * It's an array of session object objects.
 *
 */
SessionManager.prototype._instances = [];

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
  var sids = [];
  for (var i = SessionManager.prototype._instances.length - 1; i >= 0; i--) {
    sids.push(SessionManager.prototype._instances[i].sid);
  }
  console.debug(' [session:' + this.platform + '] all session IDs: ', sids);
  return sids;
};

SessionManager.prototype._getSessionIfExists = function (sid) {
  for (var i = SessionManager.prototype._instances.length - 1; i >= 0; i--) {
    if (SessionManager.prototype._instances[i].sid === sid) {
      return SessionManager.prototype._instances[i];
    }
  }
  return undefined;
};

SessionManager.prototype._addSession = function (session) {
  SessionManager.prototype._removeSession(session.sid);
  SessionManager.prototype._instances.push(session);
  return true;
};

SessionManager.prototype._removeSession = function (sid) {
  for (var i = SessionManager.prototype._instances.length - 1; i >= 0; i--) {
    if (SessionManager.prototype._instances[i].sid === sid) {
      SessionManager.prototype._instances.splice(i, 1);
      return true;
    }
  }
  return false;
};

SessionManager.prototype._destroyAllSessions = function () {
  for (var i = SessionManager.prototype._instances.length - 1; i >= 0; i--) {
    if (SessionManager.prototype._instances[i].sid) {
      this.destroy(SessionManager.prototype._instances[i].sid);
    }
  }
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

  var session = SessionManager.prototype._getSessionIfExists(sid);
  if (session) {
    console.info(' [session:' + this.platform + '] session: ' + sid +
                 ', exists in local memory, using.');
    // session lives locally, return it.
    q.resolve(session);
    return q.promise;
  }

  if (!create) {
    q.reject('session does not exists and create flag is false');
    return q.promise;
  }

  var redis_key = 'sockethub:' + this.sockethubId + ':session:' + sid +
                  ':_internal';

  // check redis Db for existing session entry.
  redisPool.hgetall(redis_key, function (err, reply) {
    var Session  = require('./session/session.js');
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
    SessionManager.prototype._addSession(session);
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
    redisPool.del(channel);
    console.debug(this.log_id + 'destroyed redis key: ' + channel);
    var session = SessionManager.prototype._getSessionIfExists(sid);
    if (session) {
      // cleanup session contents manually, so in case a reference to
      // the session keeps lingering somewhere (which it shouldn't!),
      // at least there remains no compromising information (bearerToken)
      // in memory.
      session.cleanup().then(function () {
        SessionManager.prototype._removeSession(sid);
        q.resolve();
      }, function () {
        SessionManager.prototype._removeSession(sid);
        q.resolve();
      });
    } else {
      SessionManager.prototype._removeSession(sid);
      q.resolve();
    }
  } else {
    console.debug(this.log_id + 'session destroy called for all sessions');
    // destroy all sessions
    SessionManager.prototype._destroyAllSessions();
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

  var remoteStorage = new RemoteStorage(p.rsConfig);
  remoteStorage.request(p.method, p.path).then(q.resolve, q.reject);

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
 *   type     - type of data being stored, ie. 'credentials'
 *   key      - unique string to stored the data under
 *   data     - data to store
 *
 * Returns:
 *
 *   promise
 */
SessionManager.prototype._setConfig = function (platform, type, key, data) {
  var q = Q.defer();
  if (this.redis_key === '') {
    q.reject('internal error, redis_key not set!');
    return q.promise;
  }

  var _config = {};
  if (typeof data === 'undefined') {
    console.error(this.log_id + 'require three params type, key, data');
    q.reject(this.log_id + 'require three params type, key, data');
    //_config = key;
    //key = undefined;
  } else {
    _config[key] = data;
  }

  // store _config in redis hash ...
  console.debug(this.log_id + ' [session:' + platform + ':' + this.sid +
               '] setting config with key: ' + this.redis_key + platform +
               ' field: ' + type);
  var self = this;
  redisPool.hget(this.redis_key + platform, type, function (err, reply) {
    var obj;
    if (err) {
      console.error('session.getConfig error ',err);
      q.reject(err);
    } else if (!reply) {
      obj = encrypt(self.enc_key, JSON.stringify(_config));
    } else {
      // console.debug('CALLING ENCRYPT+DECRYPT (1): '+self.enc_key);
      obj = encrypt(self.enc_key,
                JSON.stringify(
                    mergeObjects(
                        JSON.parse(decrypt(self.enc_key, reply)),
                        _config
                    )
                )
            );
    }
    redisPool.hset(self.redis_key + platform, type, obj, function (err) {
      if (err) {
        console.error('session.getConfig error ', err);
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
 *   type     - type to fetch, ie. 'credentials', 'remoteStorage'
 *   key      - unique string that the data is stored under
 *   refresh  - CURRENTLY NOT IMPLEMENTED
 *
 * Example:
 *
 *    (start code)
 *    session.getConfig('credentials', 'silverbucket').
 *      then(function (credentials) {
 *        // got credential object for 'silverbucket', or null
 *      });
 *    (end code):
 *
 * Returns:
 *
 *   promise with data as first param
 */
SessionManager.prototype._getConfig = function (platform, type, key, refresh) {
  var q = Q.defer();
  if (this.redis_key === '') {
    q.reject('internal error, redis_key not set!');
    return q.promise;
  }

  if (typeof key !== 'string') {
    console.error(this.log_id + 'require three params type, key, data');
    q.reject(this.log_id + 'require three params type, key, data');
    //refresh = key;
    //key = undefined;
  }

  if (refresh) {
    console.warn('session.getConfig called with refresh=true, this isnt currently supported. setting false');
    refresh = false;
  }

  if (!refresh) { // get from redis
    console.debug(' [session:' + platform + ':' + this.sid +
                  '] getting config with key: ' + this.redis_key + platform +
                  ' type: ' + type + ' key: ' + key);
    var self = this;
    redisPool.hget(this.redis_key + platform, type, function (err, reply) {
      if (err) {
        console.error('session.getConfig error ',err);
        q.reject(err);
      } else if (typeof reply === 'string') {
        //console.debug('CALLING DECRYPT (2): '+self.enc_key);
        var obj = JSON.parse(decrypt(self.enc_key, reply));
        if (typeof key === 'string') {
          if (typeof obj[key] !== 'undefined') {
            q.resolve(obj[key]);
          } else {
            q.reject('no key found for ' + key);
          }
        } else {
          q.resolve(obj);
        }
      } else {
        q.reject(type + ' not found');
      }
    });
  } else {
    q.resolve({});
  }
  return q.promise;
};

module.exports = SessionManager;