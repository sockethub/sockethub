
var xmpp = require('node-xmpp');
var promising = require('promising');

var clients = {};

var idCounter = 0;

function nextId() {
  return ++idCounter;
}

function jidStripResource(jid) {
  return jid.split('/')[0];
}

function getClient(session, sessionId, jid) {
  var promise = promising();
  var bareJid = jidStripResource(jid);
  if (clients[sessionId] && clients[sessionId][jid]) {
    return promise.fulfill(clients[sessionId][jid]);
  } else {
    session.getConfig('credentials').then(function (xmppSettings) {
      session.log('got settings', xmppSettings);
      var account = xmppSettings[bareJid];
      if (account === 'undefined') {
        promise.reject('unable to find credentials for '+bareJid);
      } else {
        session.log('have account for jid' + jid);
        account.jid = jid;
        var client = new xmpp.Client(account);
        client.on('online', function() {
          session.log('online now with jid', jid);
          if (! clients[sessionId]) {
            clients[sessionId] = {};
          }
          clients[sessionId][jid] = client;
          promise.fulfill(client);
        });
        client.on('error', function(error) {
          promise.reject("Failed to create XMPP client: " + error);
        });
        client.on('stanza', function(stanza) {
          session.log("id:" + jid + " received: " + stanza);
          if (stanza.name === 'message') {
            session.send({
              verb: 'send',
              actor: { address: stanza.from },
              target: { to: { address: stanza.to } },
              object: {
                text: stanza.getChild('body').text(),
                id: nextId()
              }
            });
          }
        });
      }
    }, function (err) {
      promise.reject(err);
    });
  }
  return promise;
}

module.exports = {
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
              "jid" : {
                "name" : "username",
                "required" : true,
                "type": "string"
              },
              "password" : {
                "name" : "password",
                "required" : true,
                "type": "string"
              }
            }
          }
        }
      }
    }
  },

  cleanup: function(session, sessionId) {
    var xmppClients = clients[sessionId];
    if (xmppClients) {
      for (var jid in xmppClients) {
        session.log("CLEANUP", sessionId, jid);
        xmppClients[jid].end();
      }
      delete clients[sessionId];
    }
  },

  send: function(job, session) {
    session.log('send called');
    session.getConfig('credentials').then(function (credentials) {
      if (typeof credentials[job.actor.address] === 'undefined') {
        promise.reject('unable to get credentials for '+job.actor.address);
        return;
      }
      var creds = credentials[job.actor.address];
      var accountJid = creds.jid;

      getClient(session, job.sessionId, accountJid).then(function (client) {
        session.log('got client for '+accoutJid);
        client.send(
          new xmpp.Element('message', {
            to: job.target.address,
            type: 'chat'
          }).c('body').t(job.object.text)
        );
      }, function(error) {
        promise.reject(error);
      });

    }, function (err) {
      promise.reject(err);
    });

  }
};

