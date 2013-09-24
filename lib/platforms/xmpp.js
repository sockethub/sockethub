/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

var promising = require('promising');

function registerListeners(fullJid, actor, xmpp, session, handlers) {
  var sessionId = session.getSessionID();
  session.log('registering listeners for sessionId: '+sessionId);

  var listeners = {};

  if (!handlers) {
    handlers = {};
  }


  listeners['stanza'] = function (stanza) {
    session.log("[session: "+sessionId+"] got XMPP stanza: " + stanza);
    if (stanza.is('iq')) {

      var query = stanza.getChild('query');
      if (query) {
        var entries = query.getChildren('item');
        for (var e in entries) {
          console.log('STANZA ATTRS: ', entries[e].attrs);
          if (entries[e].attrs.subscription === 'both') {
            session.send({
              verb: 'update',
              actor: { address: entries[e].attrs.jid, name: entries[e].attrs.name },
              target: [{ address: actor }],
              object: {
                statusText: '',
                state: 'offline'
              }
            });

          } else if ((entries[e].attrs.subscription === 'from') &&
                      (entries[e].attrs.ask) && (entries[e].attrs.ask === 'subscribe')) {
            session.send({
              verb: 'update',
              actor: { address: entries[e].attrs.jid, name: entries[e].attrs.name },
              target: [{ address: actor }],
              object: {
                statusText: '',
                state: 'notauthorized'
              }
            });
          } else {
            /**
             * cant figure out how to know if one of these query stanzas are from
             * added contacts or pending requests
             */
            session.send({
              verb: 'request-friend',
              actor: { address: entries[e].attrs.jid, name: entries[e].attrs.name },
              target: [{ address: actor }]
            });
          }
        }
      }
    }
  };
  xmpp.on('stanza', listeners['stanza']);

  listeners['chat'] = function (from, message) {
    session.log("received chat message from "+from);
    session.send({
      verb: 'send',
      actor: { address: from },
      target: [{ address: actor }],
      object: {
        text: message,
        id: nextId()
      }
    });
  };
  xmpp.on('chat', listeners['chat']);

  listeners['buddy'] = function (from, state, statusText) {
    if (from !== actor) {
      session.log('received buddy state update: ' + from + ' - ' + state);
      session.send({
        verb: 'update',
        actor: { address: from },
        target: [{ address: actor }],
        object: {
          statusText: statusText,
          state: state
        }
      });
    }
  };
  xmpp.on('buddy', listeners['buddy']);

  listeners['subscribe'] = function (from) {
    session.log('received subscribe request from '+from);
    session.send({
      verb: "request-friend",
      actor: { address: from },
      target: [{address: actor}]
    });
  };
  xmpp.on('subscribe', listeners['subscribe']);

  listeners['unsubscribe'] = function (from) {
    session.log('received unsubscribe request from '+from);
    session.send({
      verb: "remove-friend",
      actor: { address: 'xmpp' },
      target: [{address: actor}]
    });
  };
  xmpp.on('unsubscribe', listeners['unsubscribe']);


  if (handlers.close) {
    listeners['close'] = handlers.close;
  } else {
    listeners['close'] = function () {
      session.log('received close event with no handler specified');
      session.send({
        verb: 'close',
        actor: { address: actor },
        target: [{address: actor}]
      });
    };
  }

  xmpp.on('close', listeners['close']);

  if (handlers.error) {
    listeners['error'] = handlers.error;
  } else {
    listeners['error'] = function (error) {
      try {
        session.log("*** XMPP ERROR: " + error);
      } catch (e) {
        console.log('*** XMPP ERROR: ', e);
      }
    };
  }
  xmpp.on('error', listeners['error']);

  if (handlers.online) {
    listeners['online'] = handlers['online'];
  } else {
    listeners['online'] = function () {
      console.log('online');
      session.log('reconnectioned '+fullJid);
    };
  }

  return listeners;
}



/**
 * Function: ClientManager
 *
 * The object responsible for keeping the xmpp session of a client along
 * with it's related meta data (actor name, fullJid, session object, credentials)
 *
 *
 * Returns:
 *
 *   return description
 */
function ClientManager() {
  this.clients = {};
}

/**
 * Function: connect
 *
 * establish a new xmpp connection and store all the relevant session and
 * listener details, along with refcount, into a client object
 *
 * Parameters:
 *
 *   fullJid - fullJid of user: <user>@<domain>/<resource>
 *   actor   - actor address
 *   xmpp    - the xmpp object returned from simple-xmpp
 *   session - session object
 *   account - the account credential data to be passed to simple-xmpp
 *             (used for reconnect)
 *
 * Returns:
 *
 *   return description
 */
ClientManager.prototype.connect = function connect(fullJid, actor, xmpp, session, account) {
  var self = this;
  var promise = promising();

  var handlers = {}; // preset handlers to pass to registerListeners

  handlers['error'] = function (error) {
    try {
      session.log("*** XMPP ERROR: " + error);
      promise.reject();
    } catch (e) {
      console.log('*** XMPP ERROR: ', e);
    }
  };

  handlers['online'] = function () {
    console.log('online');
    if (self.addClient(fullJid, session, false)) {
      session.log('online now with jid: ' + fullJid);
      xmpp.getRoster();
      session.log('requested XMPP roster');
      try {
        promise.fulfill();
      } catch (e) {
        console.log('online: promise already used');
      }
    } else {
      session.log('reconnectioned '+fullJid);
    }
  };

  handlers['close'] = function () {
    console.log('XMPP: close received for '+fullJid, self);
    if ((self) && (typeof self.clients === 'object') && (self.clients[fullJid])) {
     console.log('errrrrr');
     if (self.clients[fullJid].refCount <= 0) {
       // delete xmpp client session for good
       console.log('XMPP: deleting client session');
       delete self.clients[fullJid];
     } else {
       // reconnect
       console.log('XMPP: there are still [' + self.clients[fullJid].refCount +
                   '] references, SHOULD BE reconecting client (not implemented)');
       // not sure what the best way to go about reconnecting is
       // FIXME
     }
    }
  };

  var listeners = registerListeners(fullJid, actor, xmpp, session, handlers);

  xmpp.on('online', listeners['online']);

  var client = {
    refCount: 0,
    xmpp: xmpp,
    fullJid: fullJid,
    actor: actor,
    account: account,
    sessions: {}
  };
  client.sessions[session.getSessionID()] = {};
  client.sessions[session.getSessionID()]['session'] = session;
  client.sessions[session.getSessionID()]['listeners'] = listeners;

  self.clients[fullJid] = client;

  xmpp.connect(account);
  session.log('sent XMPP connect: ', account);
  return promise;
};

/**
 * Function: addClient
 *
 * adds a client to the index based on key. incrementing the reference count
 * for already added clients.
 *
 * Parameters:
 *
 *   fullJid - fullJid of user: <user>@<domain>/<resource>
 */
ClientManager.prototype.addClient = function addClient(fullJid, session, reListen) {
  var self = this;
  if (self.clients[fullJid]) {
    self.clients[fullJid].refCount = self.clients[fullJid].refCount + 1;
    if (reListen) { // re-register listeners
      var actor = self.clients[fullJid].actor;
      var xmpp = self.clients[fullJid].xmpp;
      self.clients[fullJid].sessions[session.getSessionID()] = {};
      self.clients[fullJid].sessions[session.getSessionID()].listeners = registerListeners(fullJid, actor, xmpp, session);
    }
    return self.clients[fullJid].xmpp;
  } else {
    console.log('****** ERROR ***** ');
    return false;
  }
};


/**
 * Function: closeClient
 *
 * Handles closing the clients xmpp connection and clearing up any related
 * objects and listeners.
 *
 * Parameters:
 *
 *   fullJid - fullJid of user: <user>@<domain>/<resource>
 *   session - session object
 *
 * Returns:
 *
 *   return promise
 */
ClientManager.prototype.closeClient = function closeClient(fullJid, session) {
  var self = this;
  var promise = promising();

  session.log('closing client for session:'+session.getSessionID());

  setTimeout(function () {
    if (self.clients[fullJid]) {
      self.clients[fullJid].refCount = self.clients[fullJid].refCount - 1;
      console.log('XMPP: close timeout: ref count '+self.clients[fullJid].refCount);
      if (self.clients[fullJid].refCount <= 0) {
        // end client
        console.log('XMPP: should be closing session - but we dont know how!');
        self.clients[fullJid].xmpp.conn.end();
        setTimeout(function () {
          delete self.clients[fullJid].xmpp;
          delete self.clients[fullJid];
          promise.fulfill();
        }, 0);
      } else {
        // refresh roster for newly connected client (using existing session)
        session.log('issuing roster request');
        self.clients[fullJid].xmpp.getRoster();
        promise.fulfill();
      }
    }
  }, 10000); // delay for 10s

  // remove all listeners
  if ((self.clients[fullJid]) &&
      (self.clients[fullJid].sessions[session.getSessionID()])) {
    var listeners = self.clients[fullJid].sessions[session.getSessionID()].listeners;

    for (var name in listeners) {
      session.log('removing listener '+name);
      self.clients[fullJid].xmpp.events.removeListener(name, listeners[name]);
    }
  }

  return promise;
};

ClientManager.prototype.getClient = function getClient(key) {
  if (this.clients[key]) {
    return this.clients[key].xmpp;
  } else {
    return false;
  }
};

ClientManager.prototype.existsClient = function existsClient(key) {
  return (this.clients[key]) ? true : false;
};



var CM = new ClientManager();

var idCounter = 0;
function nextId() {
  return ++idCounter;
}



var Xmpp = function() {
  var schema = {
    "set": {
      "additionalProperties": false,
      "properties": {
        "credentials" : {
          "type": "object",
          "required": true,
          "patternProperties" : {
            ".+": {
              "type": "object",
              "required": true,
              "additionalProperties": false,
              "properties": {
                "actor": {
                  "type": "object",
                  "required": false,
                  "properties" : {
                    "address" : {
                      "name" : "address",
                      "required" : true,
                      "type": "string"
                    },
                    "name" : {
                      "name" : "name",
                      "required" : false,
                      "type": "string"
                    }
                  }
                },
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
    }
  };

  var session = '',
      sessionId = '',
      fullJid = '';

  function jidStripResource(jid) {
    return jid.split('/')[0];
  }

  function getClient(actor) {
    session.log('getClient called');
    var promise = promising();


    if ((fullJid) && (CM.existsClient(fullJid))) {
      session.log('returning stored client');
      promise.fulfill(CM.getClient(fullJid));
    } else {
      session.getConfig('credentials').then(function (credentials) {
        session.log('got config for ' + actor);
        if (typeof credentials[actor] === 'undefined') {
          promise.reject('unable to get credentials for ' + actor);
          return;
        }

        var creds = credentials[actor];
        var bareJid;
        if (creds.username.indexOf('@') === -1) {
          bareJid = creds.username + '@' + creds.server;
        } else {
          bareJid = creds.username;// + '@' + creds.server;
        }
        var fullJid = bareJid + '/' + creds.resource;
        fullJid = fullJid;
        session.log('fullJid: '+fullJid);

        if (CM.existsClient(fullJid)) {
          session.log('returning existing client for '+fullJid);
          promise.fulfill(CM.addClient(fullJid, session, true));
          return;
        }
        session.log('creating new client for '+fullJid);

        var account = {
          jid: fullJid,
          password: creds.password
        };
        if (creds.server) {
          account.host = creds.server;
        }
        if (creds.port) {
          account.port = creds.port;
        }


        if (typeof(xmpp) !== 'object') {
          xmpp = require('simple-xmpp');
        }
        CM.connect(fullJid, actor, xmpp, session, account).then(function () {
          promise.fulfill(xmpp);
        }, function () {
          promise.reject('failed to connect');
        });
      }, function (error) {
        promise.reject(error);
      });
    }
    return promise;
  }


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
  function init(sess) {
    var promise = promising();
    session = sess;
    sessionId = sess.getSessionID();
    promise.fulfill();
    return promise;
  }

  function cleanup() {
    console.log('cleanup called for'+session.getSessionID());

    var promise = promising();

    if (fullJid) {
      CM.closeClient(fullJid, session).then(function () {
        promise.fulfill();
      }, function () {
        promise.reject('failed to clear session');
      });
    } else {
      promise.fulfill();
    }
    return promise;
  }

  function send(job) {
    var promise = promising();
    session.log('send() called');
    getClient(job.actor.address).then(function (client) {
      session.log('sending message to ' + job.target[0].address);
      client.send(
          job.target[0].address,
          job.object.text
      );
      promise.fulfill();
    }, function (error) {
      promise.reject(error);
    });

    return promise;
  }

  function requestFriend(job) {
    var promise = promising();

    getClient(job.actor.address).then(function (client) {
      session.log('friend request to ' + job.target[0].address);
      client.subscribe(
          job.target[0].address
      );
      promise.fulfill();
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  }

  function removeFriend(job) {
    var promise = promising();

    getClient(job.actor.address).then(function (client) {
      session.log('friend removal of ' + job.target[0].address);
      client.unsubscribe(
          job.target[0].address
      );
      promise.fulfill();
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  }

  function makeFriend(job) {
    var promise = promising();

    getClient(job.actor.address).then(function (client) {
      session.log('friend request confirmation to ' + job.target[0].address);
      client.acceptSubscription(
          job.target[0].address
      );
      promise.fulfill();
    }, function(error) {
      promise.reject(error);
    });

    return promise;
  }

  function update(job) {
    var promise = promising();

    var show = job.object.show === 'available' ? 'chat' : job.object.show;
    var status = job.object.status || '';

    session.log('update(): ' + show + ' - ' + status);

    getClient(job.actor.address).then(function (client) {
      session.log('setting presence: ', JSON.stringify(job.object));
      client.setPresence(show, status);

      /*if (job.object.roster) {
        _.session.log('requesting roster list');
        client.getRoster();
      }*/

      promise.fulfill();
    }, function (err) {
      promise.reject(err);
    });

    return promise;
  }


  /**
   * List of commands exposed by this platform to the listener
   */
  return {
    schema: schema,
    init: init,
    cleanup: cleanup,
    send: send,
    'request-friend': requestFriend,
    'remove-friend': removeFriend,
    'make-friend': makeFriend,
    update: update
  };

};

module.exports = Xmpp;