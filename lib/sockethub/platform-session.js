var curry = require('curry');

function PlatformSession(platform, sessionId) {

  function send(p) {
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
  }

  function log(msg, dump) {
    //console.debug('platform: ',platform);
    if (dump) {
      console.info(' [platform:' + platform + '] ' + msg, dump);
    } else {
      console.info(' [platform:' + platform + '] ' + msg);
    }
  }

  function getSessionID() {
    return sessionId;
  }

  return {
    // FIXME prototypal inheretence FTW?
    setConfig: curry([platform], setConfig),
    getConfig: curry([platform], getConfig),
    send: send,
    log: log,
    promising: require('promising'),
    getSessionID: getSessionID
  };
}

module.exports = PlatformSession;