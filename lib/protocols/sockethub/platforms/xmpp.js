
var promising = require('promising');

var Xmpp = function() {
  var o = {};
  o.schema = {
    "set": {
      "credentials" : {
        "type": "object",
        "required": true,
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

  _.setStatus = function setStatus(client, object) {
    //client.
  };

  _.getClient = function getClient(actor) {
    _.session.log('getClient called');
    var promise = promising();

    if (_.clients[actor]) {
      _.session.log('returning stored client');
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

        xmpp.on('stanza', function (stanza) {
          _.session.log("got XMPP stanza: " + stanza);
          //console.log(stanza);
        });

        xmpp.on('error', function (error) {
          try {
            _.session.log("got XMPP error: " + error);
          } catch (e) {
            console.log('XMPP ONERROR: ', e);
          }

          if (typeof _.clients[actor] !== undefined) {
            try {
              console.log('rejecting promise onerror');
              promise.reject("Failed to create XMPP client: " + error);
            } catch (e) {
              console.log('failed rejecting promise on error');
            }
          } else {
            //delete _.clients[actor];
          }
        });

        xmpp.on('chat', function (from, message) {
          _.session.log("received chat message from "+from);
          _.session.send({
            verb: 'send',
            actor: { address: from },
            target: [{ address: actor }],
            object: {
              text: message,
              id: _.nextId()
            }
          });
        });

        xmpp.on('buddy', function (from, state, statusText) {
          if (from !== actor) {
            _.session.log('received buddy state update: ' + from + ' - ' + state);
            _.session.send({
              verb: 'update',
              actor: { address: from },
              target: [{ address: actor }],
              object: {
                statusText: statusText,
                state: state
              }
            });
          }
        });

        xmpp.on('subscribe', function (from) {
          _.session.log('received subscribe request from '+from);
          _.session.send({
            verb: "request-friend",
            actor: { address: from },
            target: [{address: actor}]
          });
        });

        xmpp.on('unsubscribe', function (from) {
          _.session.log('received unsubscribe request from '+from);
          _.session.send({
            verb: "remove-friend",
            actor: { address: from },
            target: [{address: actor}]
          });
        });

        xmpp.on('online', function() {
          _.session.log('online now with jid: ' + fullJid);
          _.clients[actor] = xmpp;

          xmpp.getRoster();
          _.session.log('requested XMPP roster');
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


  /**
   * Function: init
   *
   * initialize the platform - this is called by the listener during each
   *                           session initialization, and subsequent resets.
   *
   * Parameters:
   *
   *   sess - session object, to send new messages, and log.
   *
   * Returns:
   *
   *   return promise
   */
  o.init = function init(sess) {
    var promise = promising();
    _.session = sess;
    _.sessionId = sess.getSessionID();
    promise.fulfill();
    return promise;
  };

  o.cleanup = function cleanup() {
    var promise = promising();
    for (var jid in _.clients) {
      _.session.log("CLEANUP session:" + _.sessionId + " JID:" + jid);
      try {
        _.clients[jid].end();
        delete _.clients[jid];
      } catch (e) {
        _.session.log("unabled to end xmpp connection for client "+jid+":", e); //deleting reference anyway.",e);
      }
    }
    //_.clients = {};
    setTimeout(function () {
      //_.session = {
      //  log: function(p) { console.log(p); }
      //};
      //_.sessionId = {};
      promise.fulfill();
    }, 0);
    return promise;
  };

  o.send = function send(job) {
    var promise = promising();
    _.session.log('send() called');
    _.getClient(job.actor.address).then(function (client) {
      _.session.log('sending message to ' + job.target[0].address);
      client.send(
          job.target[0].address,
          job.object.text
      );
      promise.fulfill(null, true);
    }, function (error) {
      promise.reject(error);
    });

    return promise;
  };

  o['request-friend'] = function requestFriend(job) {
    var promise = promising();

    _.getClient(job.actor.address).then(function (client) {
      _.session.log('friend request to ' + job.target[0].address);
      client.subscribe(
          job.target[0].address
      );
      promise.fulfill(null, true);
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  };

  o['remove-friend'] = function removeFriend(job) {
    var promise = promising();

    _.getClient(job.actor.address).then(function (client) {
      _.session.log('friend removal of ' + job.target[0].address);
      client.unsubscribe(
          job.target[0].address
      );
      promise.fulfill(null, true);
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  };

  o['make-friend'] = function makeFriend(job) {
    var promise = promising();

    _.getClient(job.actor.address).then(function (client) {
      _.session.log('friend request confirmation to ' + job.target[0].address);
      client.acceptSubscription(
          job.target[0].address
      );
      promise.fulfill(null, true);
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  };

  o['update'] = function update(job) {
    var promise = promising();

    var show = job.object.type === 'available' ? '' : job.object.type;
    var status = job.object.status || '';

    _.getClient(job.actor.address).then(function (client) {
      _.session.log('setting presence: ', JSON.stringify(job.object));
      client.conn.send(
        new client.nodeXmpp.Element('presence', {
          to: (job.target && job.target.address ?
               job.target.address : job.actor.address)
        }).c('show', show).up().c('status', status)
      );
      promise.fulfill(null, true);
    }, function (err) {
      promise.reject(err);
    });

    return promise;
  };

  return o;
};

module.exports = Xmpp;