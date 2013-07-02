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
var curry = require('curry');
var http = require('http');
var https = require('https');
var url = require('url');
var redis = require('redis');
var crypto = require('crypto');
var util = require('./util.js');
var sockethubId = '';
var encKey = '';

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
  //console.log('**** ENCRYPT string: '+string);
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
  //console.log('**** DECRYPT string: '+string);
  return string;
}



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
var Session = function (sockethubId, encKey) {
  var pub = {};

  //console.debug('session created for '+sockethubId+" with encKey:"+encKey);
  if (!encKey) {
    throw new util.SockethubError('did not receive encKey, cannot initialize');
  }

  //
  // create the session instance for the given session ID.
  // - If it exists in memory, it's returned.
  // - If it exists in the redis store, it's retreived and built for a local
  //   instance.
  // - If the session doesn't exist yet, a new one will be created.
  //
  pub.get = function (sid) {
    var promise = promising();
    console.log('Session.get('+sid+') called.');

    if (sid in Session.prototype.instances) {
      console.info(' [session] session: ' + sid + ', exists locally.');
      // session lives locally, return it.
      promise.fulfill(Session.prototype.instances[sid]);
      return promise;
    }

    var client = redis.createClient();
    var redis_key = 'sockethub:'+sockethubId+':session:'+sid+':_internal';
    var session;

    // check redis Db for existing session entry.
    client.get(redis_key, function (err, reply) {
      if (!reply) {
        // session does not exist. crete one.
        session = new SessionInstance(sid); //, redis_key);
        console.info(' [session] created sid ' + sid + '. [redis_key:'+redis_key+']');
      } else {
        // session exists, create local session object, passing reply data
        session = new SessionInstance(sid); //, reply);
        console.info(' [session] ???? retreived from redis, creating. sid ' + sid + '. [redis_key:'+redis_key+']');
      }
      Session.prototype.instances[sid] = session;
      promise.fulfill(session);
    });

    return promise;
  };


  pub.destroy = Session.prototype.destroy;
  pub.getAllSessionIDs = Session.prototype.getAllSessionIDs;


  var SessionInstance = function (sid) {
    console.log('SessionInstance called - sid:'+sid);
    var spub = {};
    var _ = {
      platforms: {},  // platforms used by this session
      registered: false,
      secret: '',
      redis_key: 'sockethub:'+sockethubId+':session:'+sid+':', // needs <platform> or '_internal' appended
      enc_key: encKey + sid
    };


    // internal function, only exposed with a curry for platform name.
    function setConfig(platform, name, _config) {
      var promise = promising();
      if (_.redis_key === '') {
        promise.reject('internal error, redis_key not set!');
        return promise;
      }
      // store _config in redis hash ...
      var client = redis.createClient();
      console.info(' [session:'+sid+'] setting config with key: '+_.redis_key+platform+' field: '+name);
      client.hget(_.redis_key+platform, name, function (err, reply) {
        var obj;
        if ((reply === null) ||
              (reply === undefined) ||
              (reply === 'undefined')) {
          obj = encrypt(_.enc_key, JSON.stringify(_config));
        } else {
          obj = encrypt(_.enc_key, JSON.stringify(mergeObjects(JSON.parse(decrypt(_.enc_key, reply)), _config)));
        }
        client.hset(_.redis_key+platform, name, obj, function (err, replies) {
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
      var promise = promising();
      if (_.redis_key === '') {
        promise.reject('internal error, redis_key not set!');
        return promise;
      }

      if (refresh) {
        console.warn('session.getConfig called with refresh=true, this isnt currently supported. setting false');
        refresh = false;
      }

      if (!refresh) { // get from redis
        var client = redis.createClient();
        console.debug(' [session:'+sid+'] getting config with key: '+_.redis_key+platform+' field: '+name);
        client.hget(_.redis_key+platform, name, function (err, reply) {
          if ((reply === null) ||
              (reply === undefined) ||
              (reply === 'undefined')) {

            promise.reject('could not get ' + name);
          } else {
            var obj = JSON.parse(decrypt(_.enc_key, reply));
            promise.fulfill(obj);
          }
        });
      } else {
        promise.fulfill({});
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
    spub.setConfig = curry(['_internal'], setConfig);
    // get the config for the specified data branch. first check local memory
    // then, if not there, get from redis.
    spub.getConfig = curry(['_internal'], getConfig);


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
      var send_channel = 'sockethub:' + sockethubId + ':dispatcher:outgoing:' + sid;
      var client = redis.createClient();
      //console.debug(' [session] send object: ',p);
      var json_msg = JSON.stringify(p);
      console.info(' [session] sending message on channel ' + send_channel + ": ", json_msg);
      client.rpush(send_channel, json_msg);
    }
    spub.send = send;


    // clears any existing data from redis, just in case.
    _.purgeConfig = function (platform) {
      var client = redis.createClient();
      var platforms;
      if (platform) {
        platforms = [platform];
      } else {
        platforms = spub.getPlatforms();
        platforms.push('_internal');
      }
      for (var i = 0, num = platforms.length; i < num; i = i + 1) {
        client.del(_.redis_key+platforms[i]);
      }
    };

    // Reset the session.
    spub.reset = function() {
      _.purgeConfig();
      _.platforms = {};
      _.secret = {};
      _.registered = false;
      _.redis_key = '';
      sid = '';
    };

    spub.register = function (secret) {
      console.info(' [session] registering sid:' + sid);
      if (secret) {
        _.secret = secret;
        _.registered = true;
        _.purgeConfig('_internal');
        return true;
      } else {
        // must have the secret passed during register
        return false;
      }
    };
    spub.unregister = function () {
      _.registered = false;
    };
    spub.isRegistered = function () {
      return _.registered;
    };
    spub.getSecret = function() {
      return _.secret;
    };
    spub.getSessionID = function() {
      return sid;
    };

    spub.getResponseHandler = function (job) {
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
          send(p);
        };
    };


    function platformSession(platform, predisdata) {
      var ppub = {};

      ppub.setConfig = curry([platform], setConfig);
      ppub.getConfig = curry([platform], getConfig);

      ppub.send = function (p) {
        p.platform = platform;
        if (!p.verb) { console.error('psession.send() received no verb'); p.verb = "unknown"; }
        else if (!p.actor) { console.error('psession.send() received no actor'); p.actor = {"address": "unknown"}; }
        //else if (!p.status) { console.error('psession.send() received no status'); }
        else if (!p.target) { console.error('psession.send() received no target ['+p.target+':'+typeof p.target+']'); p.target = [{"address": "unknown"}]; }
        else if (!p.object) { console.debug('psession.send() received no object'); p.object = {}; }

        //|| (p.rid) || (!p.target) || (!p.object)) {
        //  throw "recevied invalid object to send to client, missing basic set of properties";
        //}
        send(p);
      };

      ppub.log = function(msg, dump) {
        //console.debug('platform: ',platform);
        if (dump) {
          console.info(' [platform:' + platform + '] ' + msg, dump);
        } else {
          console.info(' [platform:' + platform + '] ' + msg);
        }
      };

      ppub.promising = promising;
      ppub.getSessionID = spub.getSessionID;

      return ppub;
    }

    spub.getPlatformSession = function (platform) {
      ///console.debug(' [session] getPlatformSession() called with platform: ',platform);
      var promise = promising();

      if (platform in _.platforms) {
        // session lives locally, return it.
        console.debug(' [session] retreived platform session for ' + platform + ' locally.');
        promise.fulfill(_.platforms[platform]);
      } else {
        var client = redis.createClient();
        var psession;

        // check redis DB for existing session entry.
        client.get(_.redis_key+platform, function (err, reply) {
          if (!reply) {
            // session does not exist. crete one.
            psession = new platformSession(platform);
            console.debug(' [session] created platform session for ' + platform + '. [redis_key:'+_.redis_key+platform+']');
          } else {
            // session exists, create local session object, passing reply data
            psession = new platformSession(platform, reply);
            console.debug(' [session] retreived from redis, platform session for ' + platform + '.');
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
    spub.getFile = function (module, path) {
      var promise = promising();
      //console.log('getFile called:'+module+' '+path);
      spub.getConfig('remoteStorage').then(function (rsConfig) {
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
      spub.getConfig('remoteStorage').then(function (rsConfig) {
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
    spub.getPlatforms = function() {
      return Object.keys(_.platforms);
    };

    return spub;
  };
  return pub;
};


Session.prototype.instances = {};
Session.prototype.getAllSessionIDs = function () {
  var sids = Object.keys(Session.prototype.instances);
  console.debug(' [session] all session IDs: ',sids);
  return sids;
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
Session.prototype.request = function(rsSettings, method, path, mimeType, body) {
  console.debug(' [session] request: '+method+' '+path);
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

    console.debug(' [session] https options: '+JSON.stringify(options));
    var req;
    try {
      if (options.protocol === 'http:') {
        req = http.request(options);
      } else {
        req = https.request(options);
      }
    } catch (e) {
      console.error(' [session] error with request: ' + e);
      promise.reject();
      return false;
    }

    req.on('error', function (e) {
      console.error(' [session] request caught error: ' + e);
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
    console.info(' [session] destroying session '+sid);
    client = redis.createClient();
    var channel = 'sockethub:' + sockethubId + ':session:' + sid;
    client.del(channel);
    console.debug(' [session] destroyed redis instances: ' + channel);
    var session = Session.prototype.instances[sid];
    if (session) {
      // cleanup session contents manually, so in case a reference to
      // the session keeps lingering somewhere (which it shouldn't!),
      // at least there remains no compromising information (bearerToken)
      // in memory.
      console.debug(' [session] reset');
      session.reset();
    } else {
      console.warn(" [session] can't find session instance");
    }
    delete Session.prototype.instances[sid];
    promise.fulfill();
  } else {
    promise.reject("Session.prototype.destroy called without an sid");
  }
  return promise;
};

module.exports = Session;
//module.exports.destroy = Session.prototype.destroy;
//module.exports.getAllSessionIDs = Session.prototype.getAllSessionIDs;
