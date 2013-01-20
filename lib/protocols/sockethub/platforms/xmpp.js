
var xmpp = require('node-xmpp');
var promising = require('promising');

var clients = {};

function log() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[XMPP PLATFORM]');
  console.log.apply(console, args);
}

function jidStripResource(jid) {
  return jid.split('/')[0];
}

function getClient(session, sessionId, jid) {
  var bareJid = jidStripResource(jid);
  if(clients[sessionId] && clients[sessionId][jid]) {
    return promising().fulfill(clients[sessionId][jid]);
  } else {
    return session.get('messages', '.xmpp').
      then(function(xmppSettings) {
        log('got settings', xmppSettings);
        if(! xmppSettings.accounts) {
          xmppSettings.accounts = {};
        }
        var account = xmppSettings.accounts[bareJid];
        if(account) {
          log('have account for jid', jid);
          account.jid = jid;
          var client = new xmpp.Client(account);
          var promise = promising();
          client.on('online', function() {
            log('online now with jid', jid);
            if(! clients[sessionId]) {
              clients[sessionId] = {};
            }
            clients[sessionId][jid] = client;
            promise.fulfill(client);
          });
          client.on('error', function(error) {
            promise.reject("Failed to create XMPP client: " + error);
          });
          client.on('stanza', function(stanza) {
            console.log("XMPP[" + jid + "] received: " + stanza);
          });
          return promise;
        } else {
          throw "Can't find account for JID " + jid;
        }
      });
  }
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

  message: function(promise, job, session) {
    log('message called');
    var accountJid = job.actor.address;
    getClient(session, job.sessionId, accountJid).
      then(function(client) {
        log('got client');
        client.send(
          new xmpp.Element('message', {
            to: job.target.address,
            type: 'chat'
          }).c('body').t(job.object.text)
        );
        promise.fulfill();
      }, function(error) {
        promise.reject(
          "Failed to get client for JID " + accountJid + ": " + error
        );
      });
  }
};

