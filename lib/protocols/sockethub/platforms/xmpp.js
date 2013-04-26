var promising = require('promising');

function ClientManager() {
  this.clients = {};
}

/**
 * Function: addClient
 *
 * adds a client to the index based on key. incrementing the reference count
 * for already added clients.
 *
 * Parameters:
 *
 *   key     - fullJid of user: <user>@<domain>/<resource>
 *   xmpp    - the xmpp object returned from simple-xmpp
 *   account - the account credential data to be passed to simple-xmpp
 *             (used for reconnect)
 *
 * Returns:
 *
 *   returns false if the key passed already exists in the index
 *           (after incrementing the refcount).
 *   returns true if the key did not yet exist.
 */
ClientManager.prototype.addClient = function addClient(key, xmpp, account) {
  var self = this;
  if (self.clients[key]) {
    self.clients[key].refCount = self.clients[key].refCount + 1;
    return false;
  } else {
    var client = {
      refCount: 1,
      xmpp: xmpp,
      fullJid: key,
      account: account
    };
    self.clients[key] = client;

    xmpp.on('close', function () {
      console.log('XMPP: end received for '+key);
      if (self.clients[key]) {
        if (self.clients[key].refCount <= 0) {
          // delete xmpp client session for good
          console.log('XMPP: deleting client session');
          delete self.clients[key];
        } else {
          // reconnect
          console.log('XMPP: there are still ['+self.clients[key].refCount+'] references, reconecting client');
          //self.clients[key].xmpp.conn.reconnect();
          self.clients[key].xmpp.connect(self.clients[key].xmpp.account);
        }
      }
    });
    return true;
  }
};

ClientManager.prototype.closeClient = function closeClient(key) {
  var self = this;
  console.log('XMPP: CM.closeClient('+key+') -- CM.clients:', this.clients);

  setTimeout(function () {
    if (self.clients[key]) {
      self.clients[key].refCount = self.clients[key].refCount - 1;
      console.log('XMPP: close timeout: ref count '+self.clients[key].refCount);
      if (self.clients[key].refCount <= 0) {
        // end client
        console.log('XMPP: sending client.conn.end()');
        self.clients[key].xmpp.conn.end();
      }
    }
  }, 10000); // delay for 10s
};

ClientManager.prototype.getClient = function getClient(key) {
console.log('XMPP: CM.getClient('+key+') -- CM.clients:', this.clients);

  if (this.clients[key]) {
    this.clients[key].refCount = this.clients[key].refCount + 1;
    return this.clients[key].xmpp;
  } else {
    return false;
  }
};

ClientManager.prototype.existsClient = function existsClient(key) {
  console.log('XMPP: CM.existsClients('+key+') -- CM.clients:', this.clients);
  return (this.clients[key]) ? true : false;
};

var CM = new ClientManager();

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
    idCounter: 0,
    fullJid: ''
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


    if ((_.fullJid) && (CM.existsClient(_.fullJid))) {
      _.session.log('returning stored client');
      promise.fulfill(CM.getClient(_.fullJid));
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
        _.fullJid = fullJid;
        _.session.log('fullJid: '+fullJid);

        if (CM.existsClient(fullJid)) {
          _.session.log('returning existing client for '+fullJid);
          promise.fulfill(CM.getClient(fullJid));
          return;
        }
        _.session.log('creating new client for '+fullJid);

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
        });

        xmpp.on('error', function (error) {
          try {
            _.session.log("got XMPP error: " + error);
          } catch (e) {
            console.log('XMPP ONERROR: ', e);
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
          if (CM.addClient(fullJid, xmpp, account)) {
            _.session.log('online now with jid: ' + fullJid);
            xmpp.getRoster();
            _.session.log('requested XMPP roster');
            promise.fulfill(xmpp);
          } else {
            _.session.log('reconnectioned '+fullJid);
          }
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
console.log('init - ClientManager: ', CM);

    var promise = promising();
    _.session = sess;
    _.sessionId = sess.getSessionID();
    promise.fulfill(null, true);
    return promise;
  };

  o.cleanup = function cleanup() {
console.log('cleanup - ClientManager: ', CM);

    var promise = promising();

    if (_.fullJid) {
      CM.closeClient(_.fullJid);
    }
    promise.fulfill();
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

  o.update = function update(job) {
console.log('update ClientManager: ', CM);
    var promise = promising();

    var show = job.object.type === 'available' ? '' : job.object.type;
    var status = job.object.status || '';

    _.getClient(job.actor.address).then(function (client) {
      _.session.log('setting presence: ', JSON.stringify(job.object));
      client.conn.send(
        new client.Element('presence', {
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