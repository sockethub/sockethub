
var xmpp = require('node-xmpp');
var promising = require('promising');

var clients = {};

function log() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[XMPP PLATFORM]');
  console.log.apply(console, args);
}

function bareJid(jid) {
  return jid.split('/')[0];
}

function getClient(storage, jid) {
  if(clients[jid]) {
    return promising().fulfill(clients[jid]);
  } else {
    return storage.get('messages', '.xmpp').
      then(function(xmppSettings) {
        log('got settings', xmppSettings);
        if(! xmppSettings.accounts) {
          xmppSettings.accounts = {};
        }
        var account = xmppSettings.accounts[jid];
        if(account) {
          log('have account for jid', jid);
          account.jid = jid;
          var client = new xmpp.Client(account);
          var promise = promising();
          client.on('online', function() {
            log('online now with jid', jid);
            clients[jid] = client;
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

  message: function(promise, job, storage) {
    log('message called');
    var accountJid = bareJid(job.actor.address);
    getClient(storage, accountJid).
      then(function(client) {
        log('got client', client);
        client.send(
          new xmpp.Element('message', {
            to: job.target.address,
            type: 'chat'
          }).c('body').t(job.object.text)
        );
      }, function(error) {
        promise.reject(
          "Failed to get client for JID " + accountJid + ": " + error
        );
      });
  }
}

