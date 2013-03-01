
var xmpp = require('node-xmpp');
var promising = require('promising');

var Xmpp = (function() {
  var pub = {
    schema: {
      "set": {
        "credentials" : {
          "type": "object",
          "required": false,
          "patternProperties" : {
            ".+": {
              "type": "object",
              "required": true,
              "properties": {
                "username" : {
                  "name" : "username",
                  "required" : true,
                  "type": "string"
                },
                "password" : {
                  "name" : "password",
                  "required" : true,
                  "type": "string"
                },
                "server" : {
                  "name" : "server",
                  "required" : true,
                  "type": "string"
                },
                "resource" : {
                  "name" : "resource",
                  "required" : true,
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }
  };
  var _ = {
    session: '',
    sessionId: '',
    clients: {},
    idCounter: 0
  };

  _.nextId = function nextId() {
    return ++_.idCounter;
  };

  _.jidStripResource = function jidStripResource(jid) {
    return jid.split('/')[0];
  };

  _.getClient = function getClient(creds) {
    _.session.log('getClient called');
    var promise = promising();
    //var bareJid = _.jidStripResource(jid);
    var bareJid = creds.username + '@' + creds.server;
    var fullJid = bareJid + '/' + creds.resource;

    if (_.clients[fullJid]) {
      promise.fulfill(_.clients[fullJid]);
    } else {
      var account = {
        jid: fullJid,
        password: creds.password
      };
      var client = new xmpp.Client(account);
      client.on('online', function() {
        _.session.log('online now with jid: ' + fullJid);
        _.clients[fullJid] = client;
        promise.fulfill(client);
      });
      client.on('error', function (error) {
        promise.reject("Failed to create XMPP client: " + error);
      });
      client.on('stanza', function (stanza) {
        _.session.log("id:" + fullJid + " received: " + stanza);
        console.log('STANZA: ',stanza);
        var sendObj = {
          verb: 'send',
          actor: { address: stanza.from },
          target: { to: [{ address: stanza.to }] },
          status: undefined,
          object: {
            text: '',
            id: _.nextId()
          }
        };

        if (stanza.type === 'error') {
          sendObj.status = false;
          sendObj.object.text = stanza.getChild('error').text();
        } else if (stanza.type === 'chat') {
          var body = stanza.getChild('body');
          var composing = stanza.getChild('cha:composing');

          if (body) {
            sendObj.status = true;
            sendObj.object.text = body.text();
          } else {
            if (composing) {
              sendObj.status = true;
              sendObj.object.text = stanza.from + ' is typing...';
            }
          }
        }

        if (typeof sendObj.status !== 'undefined') {
          _.session.send(sendObj);
        }
      });
    }
    return promise;
  };

  pub.init = function init(sess) {
    var promise = promising();
    _.session = sess;
    _.sessionId = sess.getSessionID();
    promise.fulfill();
    return promise;
  };

  pub.cleanup = function cleanup() {
    for (var jid in _.clients) {
      _.session.log("CLEANUP session:" + _.sessionId + " JID:" + jid);
      _.clients[jid].end();
      delete _.clients[jid];
    }
    _.clients = {};
    _.session = {};
    _.sessionId = {};
  };

  pub.send = function send(job) {
    var promise = promising();
    _.session.log('xmpp.send() called');
    _.session.getConfig('credentials').then(function (credentials) {
      _.session.log('got config ');
      if (typeof credentials[job.actor.address] === 'undefined') {
        promise.reject('unable to get credentials for ' + job.actor.address);
        return;
      }
      var creds = credentials[job.actor.address];

      _.getClient(creds).then(function (client) {
        _.session.log('sending message to ' + job.target.to[0].address);
        client.send(
          new xmpp.Element('message', {
            to: job.target.to[0].address,
            type: 'chat'
          }).c('body').t(job.object.text)
        );
        promise.fulfill(null, true);
      }, function(error) {
        promise.reject(error);
      });

    }, function (err) {
      promise.reject(err);
    });

    return promise;
  };

  pub.cleanup = function () {
    var promise = promising();
    _.clients = {};
    _.session = {};
    _.sessionId = {};
    return promise;
  };

  return pub;
})();

module.exports = Xmpp;