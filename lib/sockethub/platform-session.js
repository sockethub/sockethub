var SessionManager;

function PlatformSession(p) {
  if (!p.session) {
    throw Error('no session object passed to PlatformSession');
  }
  if (!p.SessionManager) {
    throw Error('SessionManager not passed to PlatformSession');
  }
  SessionManager = p.SessionManager;
  this.platform = p.session.platform;
  this.sessionId = p.session.getSessionID();
  this.session = p.session;
}

PlatformSession.prototype.promising = require('promising');

PlatformSession.prototype.getSessionID = function () {
  return this.sessionId;
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
  this.session.send(p);
};


PlatformSession.prototype.log = function () {
  //console.debug('platform: ',platform);
  if (dump) {
    console.info(' [platform:' + platform + '] ' + msg, dump);
  } else {
    console.info(' [platform:' + platform + '] ' + msg);
  }
};

PlatformSession.prototype.setConfig = function () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(this.platform);
  return SessionManager.prototype._setConfig.apply(this.session, args);
};

PlatformSession.prototype.getConfig = function () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift(this.platform);
  return SessionManager.prototype._getConfig.apply(this.session, args);
};




module.exports = function (p) {
  return new PlatformSession(p);
};
