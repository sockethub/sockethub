
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
    return promise.fulfill(null, true, clients[sessionId][jid]);
  } else {
    session.getConfig('credentials').then(function(xmppSettings) {
      session.log('got settings', xmppSettings);
      if (! xmppSettings.accounts) {
        xmppSettings.accounts = {};
      }
      var account = xmppSettings.accounts[bareJid];
      if (account) {
        session.log('have account for jid' + jid);
        account.jid = jid;
        var client = new xmpp.Client(account);
        client.on('online', function() {
          session.log('online now with jid', jid);
          if (! clients[sessionId]) {
            clients[sessionId] = {};
          }
          clients[sessionId][jid] = client;
          promise.fulfill(null, true, client);
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
      } else {
        session.log("can't find account for JID " + jid);
        promise.reject("can't find account for JID " + jid);
      }
    });
  }
  return promise;
}

module.exports = {

  cleanup: function(sessionId) {
    var xmppClients = clients[sessionId];
    if(xmppClients) {
      for(var jid in xmppClients) {
        log("CLEANUP", sessionId, jid);
        xmppClients[jid].end();
      }
      delete clients[sessionId];
    }
  },

  send: function(job, session) {
    session.log('send called');
    var accountJid = job.actor.address;
    return getClient(session, job.sessionId, accountJid).
      then(function(client) {
        session.log('got client');
        client.send(
          new xmpp.Element('message', {
            to: job.target.address,
            type: 'chat'
          }).c('body').t(job.object.text)
        );
      }, function(error) {
        session.log("Failed to get client for JID " + accountJid + ": " + error);
      });
  }
};

