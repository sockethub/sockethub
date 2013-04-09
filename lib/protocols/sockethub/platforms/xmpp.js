
var promising = require('promising');

var Xmpp = function() {
  var o = {};
  o.schema = {
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
              },
              "port": {
                "name": "port",
                "required": false,
                "type": "number"
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

  _.getClient = function getClient(actor) {
    _.session.log('getClient called');
    var promise = promising();

    if (_.clients[actor]) {
      promise.fulfill(_.clients[actor]);
    } else {
      _.session.getConfig('credentials').then(function (credentials) {
        _.session.log('got config for '+actor);
        if (typeof credentials[actor] === 'undefined') {
          promise.reject('unable to get credentials for ' + actor);
          return;
        }
        var creds = credentials[actor];
        var bareJid = creds.username;// + '@' + creds.server;
        var fullJid = bareJid + '/' + creds.resource;

        _.session.log('fullJid: '+fullJid);
        var account = {
          jid: fullJid,
          password: creds.password,
          host: creds.server,
          port: (creds.port) ? creds.port : 5222
        };

        if (typeof(xmpp) !== 'object') {
          xmpp = require('simple-xmpp');
        }

        xmpp.on('error', function (error) {
          _.session.log("got XMPP error: " + error);
          promise.reject("Failed to create XMPP client: " + error);
        });

        xmpp.on('chat', function (from, message) {
          _.session.log("received chat message from "+from);
          _.session.send({
            verb: 'send',
            actor: { address: from },
            target: { to: [{ address: actor }] },
            status: true,
            object: {
              text: message,
              id: _.nextId()
            }
          });
        });

        xmpp.on('subscribe', function (from) {
          _.session.send({
            verb: "request-friend",
            actor: { address: from },
            target: { to: [{address: actor}] },
            status: true
          });
        });

        xmpp.on('unsubscribe', function (from) {
          _.session.send({
            verb: "remove-friend",
            actor: { address: from },
            target: { to: [{address: actor}] },
            status: true
          });
        });

        xmpp.on('online', function() {
          _.session.log('online now with jid: ' + fullJid);
          _.clients[actor] = xmpp;
          promise.fulfill(xmpp);
        });

        xmpp.connect(account);
        _.session.log('sent XMPP connect');
      }, function (error) {
        promise.reject(error);
      });
    }
    return promise;
  };

  o.init = function init(sess) {
    var promise = promising();
    _.session = sess;
    _.sessionId = sess.getSessionID();
    promise.fulfill();
    return promise;
  };

  o.cleanup = function cleanup() {
    for (var jid in _.clients) {
      _.session.log("CLEANUP session:" + _.sessionId + " JID:" + jid);
      _.clients[jid].end();
      delete _.clients[jid];
    }
    _.clients = {};
    _.session = {};
    _.sessionId = {};
  };

  o.send = function send(job) {
    var promise = promising();
    _.session.log('send() called');
    _.getClient(job.actor.address).then(function (client) {
      _.session.log('sending message to ' + job.target.to[0].address);
      client.send(
          job.target.to[0].address,
          job.object.text
      );
      promise.fulfill(null, true);
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  };

  o['request-friend'] = function follow(job) {
    var promise = promising();

    _.getClient(job.actor.address).then(function (client) {
      _.session.log('friend request to ' + job.target.to[0].address);
      client.subscribe(
          job.target.to[0].address
      );
      promise.fulfill(null, true);
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  };

  o['remove-friend'] = function follow(job) {
    var promise = promising();

    _.getClient(job.actor.address).then(function (client) {
      _.session.log('friend removal of ' + job.target.to[0].address);
      client.unsubscribe(
          job.target.to[0].address
      );
      promise.fulfill(null, true);
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  };

  o['make-friend'] = function follow(job) {
    var promise = promising();

    _.getClient(job.actor.address).then(function (client) {
      _.session.log('friend request confirmation to ' + job.target.to[0].address);
      client.acceptSubscription(
          job.target.to[0].address
      );
      promise.fulfill(null, true);
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  };

  o.cleanup = function () {
    var promise = promising();
    _.clients = {};
    _.session = {};
    _.sessionId = {};
    return promise;
  };

  return o;
};

module.exports = Xmpp;