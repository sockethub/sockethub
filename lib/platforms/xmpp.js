/**
 * This file is part of sockethub.
 *
 * copyright 2012-2013 Nick Jennings (https://github.com/silverbucket)
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

if (typeof(xmpp) !== 'object') {
  xmpp = require('simple-xmpp');
}
var Q = require('q');

/**
 * Class: XMPP
 *
 * Handles all actions related to communication via. the XMPP protocol.
 *
 * Uses the `node-simple-xmpp` module as a base tool for interacting with XMPP.
 *
 * https://github.com/simple-xmpp/node-simple-xmpp
 *
 */
function XMPP() {}

/**
 * Property: schema
 *
 * JSON schema defining the credentials which are passed during the 'set'
 * verb. Actual handling of incoming 'set' commands are handled by dispatcher,
 * but the dispatcher uses this defined schema to validate credentials
 * received, so that when a platform verb is called, it can fetch the
 * credentials (`session.getConfig()`), knowing they will have already been
 * validated against this schema.
 *
 * Example valid AS object for setting XMPP credentials:
 *
 *   (start code)
 *   {
 *     verb: 'set',
 *     platform: 'dispatcher', // dispatcher handles validating incoming credentials
 *     actor: {
 *       address: 'testuser@host.com',
 *       name: 'Dr. Test User'
 *     },
 *     object: {
 *       objectType: 'credentials',
 *       username: 'testuser@host.com',
 *       password: 'asdasdasdasd'
 *       server: 'host.com',
 *       resource: 'Home',
 *       port: 1234
 *     },
 *     target: [
 *       {
 *         platform: 'xmpp'  // indicates which platform the credentials are for
 *       }
 *     ]
 *   }
 *   (end code)
 */
XMPP.prototype.schema = {
  "set": {
    "credentials" : {
      "require": ['object'],
      "properties" : {
        "object" : {
          "type": "object",
          "required": ['objectType', 'username', 'password', 'server', 'resource'],
          "additionalProperties": false,
          "properties": {
            "objectType" : {
              "name" : "objectType",
              "type": "string"
            },
            "username" : {
              "name" : "username",
              "type": "string"
            },
            "password" : {
              "name" : "password",
              "type": "string"
            },
            "server" : {
              "name" : "server",
              "type": "string"
            },
            "resource" : {
              "name" : "resource",
              "type": "string"
            },
            "port": {
              "name": "port",
              "type": "number"
            }
          }
        }
      }
    }
  }
};


var idCounter = 0;
function nextId() {
  return ++idCounter;
}

function jidStripResource(jid) {
  return jid.split('/')[0];
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
XMPP.prototype.init = function (sess) {
  this.session = sess;

  var q = Q.defer();
  q.resolve();
  return q.promise;
};



/**
 * Function: send
 *
 * Send a message to a friend.
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
 *     (start code)
 *     {
 *       platform: 'xmpp',
 *       verb: 'send',
 *       actor: {
 *         address: 'user@host.com/Home'
 *       },
 *       target: [
 *         {
 *           address: 'foo@bar.net/Home'
 *         }
 *       ],
 *       object: {
 *         text: 'Hello from Sockethub!'
 *       },
 *       rid: 1234
 *     }
 *     (end code)
 *
 */
XMPP.prototype.send = function (job) {
  var session = this.session,
      sessionId = this.session.getSessionID(),
      self = this,
      q = Q.defer();

  session.log('send() called');

  self._getClient(job).then(function (client) {

    //
    // send message
    session.log('sending message to ' + job.target[0].address);
    xmpp.send(
        job.target[0].address,
        job.object.text
    );
    q.resolve();
  }, q.reject).fail(q.reject);

  return q.promise;
};


/**
 * Function: update
 *
 * Indicate presence and status message.
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
 *     (start code)
 *     {
 *       platform: 'xmpp',
 *       verb: 'update',
 *       actor: {
 *         address: 'user@host.org/Home'
 *       },
 *       target: [],
 *       object: {
 *         objectType: 'presence'
 *         presence: 'chat',
 *         text: '...clever saying goes here...'
 *       },
 *       rid: 1234
 *     }
 *     (end code)
 *
 */
XMPP.prototype.update = function (job) {
  var session = this.session,
      sessionId = this.session.getSessionID(),
      self = this,
      q = Q.defer();

  session.log('update(): [show state: ' + show + '] [status text:' + status + ']');

  self._getClient(job).then(function (client) {

    if ((typeof job.object.objectType === 'string') &&
        (job.object.objectType === 'presence')) {
      var show = job.object.presence === 'available' ? 'chat' : job.object.show;
      var status = job.object.status || '';
      //
      // setting presence
      session.log('setting presence: ' + show + ' status: ' + status);
      client.xmpp.setPresence(show, status);
      session.log('requesting XMPP roster');
      client.xmpp.getRoster();
      /*if (job.object.roster) {
        _.session.log('requesting roster list');
        client.xmpp.getRoster();
      }*/
      q.resolve();
    } else {
      q.reject('unknown object.objectType (presence?)');
    }
  }, q.reject).fail(q.reject);

  return q.promise;
};


XMPP.prototype['request-friend'] = function (job) {
  var session = this.session,
      sessionId = this.session.getSessionID(),
      self = this,
      q = Q.defer();

  session.log('requestFriend() ',job);

  self._getClient(job).then(function (client) {
    session.log('friend request to ' + job.target[0].address);
    client.xmpp.subscribe(
        job.target[0].address
    );
    q.resolve();
  }, q.reject).fail(q.reject);

  return q.promise;
};


XMPP.prototype['remove-friend'] = function (job) {
  var session = this.session,
      sessionId = this.session.getSessionID(),
      self = this,
      q = Q.defer();

  session.log('removeFriend() ',job);

  self._getClient(job).then(function (client) {
    session.log('friend removal of ' + job.target[0].address);
    client.xmpp.unsubscribe(
        job.target[0].address
    );
    q.resolve();
  }, q.reject).fail(q.reject);

  return q.promise;
};


XMPP.prototype['make-friend'] = function (job) {
  var session = this.session,
      sessionId = this.session.getSessionID(),
      self = this,
      q = Q.defer();

  session.log('makeFriend() ',job);

  self._getClient(job).then(function (client) {
    session.log('friend request confirmation to ' + job.target[0].address);
    client.xmpp.acceptSubscription(
        job.target[0].address
    );
    q.resolve();
  }, q.reject).fail(q.reject);

  return q.promise;
};


XMPP.prototype.cleanup = function () {
  var session = this.session,
      sessionId = this.session.getSessionID(),
      self = this,
      q = Q.defer();

  session.log('cleanup called for ' + session.getSessionID());

  //
  // FIXME althoug we could set the presence to invisible. and provide
  // listeners to store the messages instance of try to send them to a session
  //
  q.resolve();
  return q.promise;
};


//
// listener functions defined here
//
// assigned during clientManager.create and then called by the clientManager
// with `session` and `client` objects in the local scope.
//
var listeners = {
  stanza: function (stanza) {
    var session = this.session,
        sessionId = this.session.getSessionID(),
        client = this.client;

    session.debug("[session: " + sessionId + "] got XMPP stanza: " + stanza);
    if (stanza.is('iq')) {
      var query = stanza.getChild('query');
      if (query) {
        var entries = query.getChildren('item');
        for (var e in entries) {
          console.debug('STANZA ATTRS: ', entries[e].attrs);
          if (entries[e].attrs.subscription === 'both') {
            session.send({
              verb: 'update',
              actor: { address: entries[e].attrs.jid, name: entries[e].attrs.name },
              target: [{ address: client.actor }],
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
              target: [{ address: client.actor }],
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
              target: [{ address: client.actor }]
            });
          }
        }
      }
    }
  },
  chat: function (from, message) {
    var session = this.session,
        sessionId = this.session.getSessionID(),
        client = this.client;

    session.log("received chat message from " + from);
    session.send({
      verb: 'send',
      actor: { address: from },
      target: [{ address: client.actor }],
      object: {
        text: message,
        id: nextId()
      }
    });
  },
  buddy: function (from, state, statusText) {
    var session = this.session,
        sessionId = this.session.getSessionID(),
        client = this.client;

    if (from !== client.actor) {
      session.log('received buddy state update: ' + from + ' - ' + state);
      session.send({
        verb: 'update',
        actor: { address: from },
        target: [{ address: client.actor }],
        object: {
          statusText: statusText,
          state: state
        }
      });
    }
  },
  subscribe: function (from) {
    var session = this.session,
        sessionId = this.session.getSessionID(),
        client = this.client;
    session.log('received subscribe request from ' + from);
    session.send({
      verb: "request-friend",
      actor: { address: from },
      target: [{ address: client.actor }]
    });
  },
  unsubscribe: function (from) {
    var session = this.session,
        sessionId = this.session.getSessionID(),
        client = this.client;

    session.log('received unsubscribe request from ' + from);
    session.send({
      verb: "remove-friend",
      actor: { address: 'xmpp' },
      target: [{ address: client.actor }]
    });
  },
  close: function () {
    var session = this.session,
        sessionId = this.session.getSessionID(),
        client = this.client;
    session.log('received close event with no handler specified');
    session.send({
      verb: 'close',
      actor: { address: client.actor },
      target: [{ address: client.actor }]
    });
    session.log('**** xmpp session for ' + client.fullJid + ' closed');
    session.clientManager.remove(client.fullJid);
  },
  error: function (error) {
    var session = this.session,
        sessionId = this.session.getSessionID(),
        client = this.client;
    try {
      session.log("*** XMPP ERROR (rl): " + error);
      session.send({
        verb: 'error',
        object: {
          objectType: 'error',
          text: error
        }
      });
    } catch (e) {
      console.log('*** XMPP ERROR (rl catch): ', e);
    }
  },
  online: function () {
    var session = this.session,
        sessionId = this.session.getSessionID(),
        client = this.client;
    console.log('online');
    session.log('reconnectioned ' + client.fullJid);
  }
};


XMPP.prototype._getClient = function (job) {
  var session = this.session,
      sessionId = this.session.getSessionID(),
      self = this,
      q = Q.defer();

  session.log('getClient called');

  var bareJid, fullJid;

  session.getConfig('credentials', job.actor.address).then(function (creds) {
    //
    // get credentials
    session.log('got config for ' + job.actor.address, creds);

    //
    // generate bareJid and fullJid
    if (creds.object.username.indexOf('@') === -1) {
      bareJid = creds.object.username + '@' + creds.object.server;
    } else {
      bareJid = creds.object.username;
    }
    var fullJid = bareJid + '/' + creds.object.resource;
    session.log('fullJid: ' + fullJid);
    //
    // check if client object already exists
    var client = session.clientManager.get(fullJid, creds);
    if (!client) {
      //
      // create new connection
      self._createClient(fullJid, creds).then(q.resolve, q.reject).fail(q.reject);

    } else {

      //
      // client already exists
      // make sure we have listeners for this session
      if (!client.listeners['online'][sessionId]) {
        mergeListeners(client, registerListeners(client));
      }
      q.resolve(client);
    }
  }, q.reject).fail(q.reject);
  return q.promise;
};

XMPP.prototype._createClient = function (key, creds) {
  var session = this.session,
      sessionId = this.session.getSessionID(),
      self = this,
      q = Q.defer();

  session.log('creating new client for '+ key);

  session.clientManager.create(key, creds, {
    timeout: 15000,
    connect: function (key, credentials, cb) {
      //
      // credential object to pass to simple-xmpp
      var simple_xmpp_creds = {
        jid: key,
        password: credentials.password
      };
      if (credentials.server) {
        simple_xmpp_creds.host = credentials.server;
      }
      if (credentials.port) {
        simple_xmpp_creds.port = credentials.port;
      }

      var client = {
        xmpp: xmpp,
        credentials: credentials,
        xmpp_creds: simple_xmpp_creds,
        key: key,
        id: key,
        fullJid: key
      };

      var handlers = {
        error: {},
        online: {},
        close: {}
      };

      var _this = this;

      handlers.error = function (error) {
        var msg = 'failed connecting '+client.fullJid;
        msg = (error) ? msg + ' : ' + error : msg;
        try {
          _this.session.debug("*** XMPP ERROR (connect error): " + error);
          client.disconnect();
        } catch (e) {
          _this.session.debug('*** XMPP ERROR (connect error): failed disconnect ', e);
        }
        cb(msg);
      };

      handlers.online = function () {
        _this.session.debug('online now with jid: ' + key);
        client.xmpp.removeListener('online', handlers.online);
        client.xmpp.removeListener('error', handlers.error);
        client.xmpp.removeListener('close', handlers.close);
        cb(null, client);
      };

      handlers.close = function () {
        // FIXME - not sure in what cases this happens
        _this.session.debug('XMPP: close received for ' + key);
        cb('received close event for '+ key);
      };

      client.xmpp.on('online', handlers.online);
      client.xmpp.on('error', handlers.error);
      client.xmpp.on('close', handlers.close);

      client.xmpp.connect(client.xmpp_creds);
      this.session.log('sent XMPP connect for account ' + key);
    },
    listeners: listeners,
    addListener: function (client, key, name, func) {
      client.xmpp.on(name, func);
    },
    removeListener: function (client, key, name, func) {
      client.xmpp.removeListener(name, func);
    },
    disconnect: function (client, key, cb) {
      // FIXME - review this, simple-xmpp has a close func now i believe
      this.session.log('should be CLOSING connection now, NOT IMPLEMENTED in node-xmpp');
      client.xmpp.disconnect();
    }
  }, function (err, client) {
    session.log('XMPP client created successfully');
    // completed
    if (err) {
      q.reject(err);
    } else {
      q.resolve(client);
    }
  });

  return q.promise;
};


module.exports = function () {
  return new XMPP();
};
