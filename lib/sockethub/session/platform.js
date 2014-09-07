var path = require('path');
var SessionManager = require('./../session-manager.js');

var filename = path.basename(module.parent.filename);
var dir = path.dirname(module.parent.filename);
var parent_dir = path.basename(dir);


if (((filename !== 'session-manager.js') && (filename !=='session.js')) ||
    ((parent_dir !== 'sockethub') && (parent_dir !== 'session')) ||
    ((dir + '/session/platform.js' !== module.id) &&
     (dir + '/platform.js' !== module.id))) {
  throw new Error('session/platform.js module has been required from unexpected source, cannot continue.');
}


/**
 * Class: PlatformSession
 *
 * the PlatformSession objects (or psession) are small subsets of the Session
 * objects and are passed to platforms during platform.init().
 *
 * the contain a number of methods that make communicating with the client
 * easy, and abstract away as much sockethub internals as possible.
 *
 * Parameters:
 *
 *  An *object* containing the following properties
 *
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
    throw new Error('no enc_key passed to PlatformSession');
  }

  this.platform = p.platform;
  this.sockethubId = p.sockethubId;
  this.sid = p.sid;
  this.redis_key = p.redis_key;
  this.log_id = ' [platform:' + this.platform + '] ';
  this.enc_key = p.enc_key;

  this.clientManager = require('./../client-manager.js')(this);
  return this;
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
  var Session = require('./session.js');
  Session.prototype.send.call(this, p);
};

function _log(type, msg, dump) {
  if (dump) {
    console[type](' [platform:' + this.platform + '] ' + msg, dump);
  } else {
    console[type](' [platform:' + this.platform + '] ' + msg);
  }
}

PlatformSession.prototype.info = function (msg, dump) {
  _log.apply(this, ['info', msg, dump]);
};

PlatformSession.prototype.log = function (msg, dump) {
  _log.apply(this, ['log', msg, dump]);
};

PlatformSession.prototype.debug = function (msg, dump) {
  _log.apply(this, ['debug', msg, dump]);
};

PlatformSession.prototype.warn = function (msg, dump) {
  _log.apply(this, ['warn', msg, dump]);
};

PlatformSession.prototype.error = function (msg, dump) {
  _log.apply(this, ['error', msg, dump]);
};

PlatformSession.prototype.setConfig = function () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(this.platform);
  return SessionManager.prototype._setConfig.apply(this, args);
};

PlatformSession.prototype.getConfig = function () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(this.platform);
  return SessionManager.prototype._getConfig.apply(this, args);
};

module.exports = PlatformSession;