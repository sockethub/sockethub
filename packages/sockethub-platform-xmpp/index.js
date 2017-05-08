/**
 * This is a platform for sockethub implementing XMPP functionality.
 *
 * copyright 2012-2016 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub-platform-xmpp.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

if (typeof (xmpp) !== 'object') {
  xmpp = require('simple-xmpp');
}

var debug = require('debug')('sockethub-platform-xmpp');
var packageJSON = require('./package.json');


/**
 * @class XMPP
 * @constructor
 *
 * @description
 * Handles all actions related to communication via. the XMPP protocol.
 *
 * Uses the `simple-xmpp` node module as a base tool for interacting with XMPP.
 *
 * {@link https://github.com/simple-xmpp/node-simple-xmpp}
 *
 * @param {object} session {@link Sockethub.Session#object}
 *
 */
function XMPP(session) {
  this.session   = session;
  this._channels = [];
}

/**
 * Property: schema
 *
 * @description
 * JSON schema defining the @types this platform accepts.
 *
 * Actual handling of incoming 'set' commands are handled by dispatcher,
 * but the dispatcher uses this defined schema to validate credentials
 * received, so that when a @context @type is called, it can fetch the
 * credentials (`session.getConfig()`), knowing they will have already been
 * validated against this schema.
 *
 *
 * In the below example, sockethub will validate the incoming credentials object
 * against whatever is defined in the `credentials` portion of the schema
 * object.
 *
 *
 * It will also check if the incoming AS object uses a @type which exists in the
 * `@types` portion of the schema object (should be an array of @type names).
 *
 * **NOTE**: For more information on using the credentials object from a client, see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)
 *
 * Valid AS object for setting XMPP credentials:
 *
 * @example
 *
 * {
 *   '@type': 'set',
 *   context: 'xmpp',
 *   actor: {
 *     '@id': 'xmpp://testuser@jabber.net',
 *     '@type': 'person',
 *     displayName: 'Mr. Test User',
 *     userName: 'testuser'
 *   },
 *   object: {
 *     '@type': 'credentials',
 *     server: 'jabber.net',
 *     username: 'testuser',
 *     password: 'asdasdasdasd',
 *     port: 5223,
 *     resource: 'phone'
 *   }
 * }
 */
XMPP.prototype.schema = {
  "version": packageJSON.version,
  "messages" : {
    "required": [ '@type' ],
    "properties": {
      "@type": {
        "enum": [ 'connect', 'update', 'send', 'join', 'request-friend', 'remove-friend', 'make-friend' ]
      }
    }
  },
  "credentials" : {
    "required": [ 'object' ],
    "properties": {
      // TODO platforms shouldn't have to define the actor property if they don't want to, just credential specifics
      "actor": {
        "type": "object",
        "required": [ "@id" ]
      },
      "object": {
        "name": "object",
        "type": "object",
        "required": [ '@type', 'username', 'password', 'server', 'resource' ],
        "additionalProperties": false,
        "properties" : {
          "@type": {
            "name": "@type",
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
          "port" : {
            "name": "port",
            "type": "number"
          },
          "resource": {
            "name": "resource",
            "type": "string"
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
 * Function: connect
 *
 * Connect to the XMPP server.
 *
 * @example
 *
 * {
 *   context: 'xmpp',
 *   '@type': 'connect',
 *   actor: {
 *     '@id': 'xmpp://slvrbckt@jabber.net/Home',
 *     '@type': 'person',
 *     displayName: 'Nick Jennings',
 *     userName: 'slvrbckt'
 *   }
 * }
 */
XMPP.prototype.connect = function (job, done) {
  var self = this;
  self.session.connectionManager.get(job.actor['@id'], createObj, function (err, client) {
    if (err) { return done(err); }
    self.session.debug('got client for ' + job.actor['@id']);
    done();
  });
};

/**
 * Function: join
 *
 * Join a room, oprionally defining a display name for that room.
 *
 * @example
 *
 * {
 *   context: 'xmpp',
 *   '@type': 'join',
 *   actor: {
 *     '@type': 'person'
 *     '@id': 'slvrbckt@jabber.net/Home',
 *   },
 *   object: {
 *     '@type': 'person',
 *     '@id': 'slvrbckt@jabber.net/Home',
 *     displayName: 'Mr. Pimp'
 *   },
 *   target: {
 *     '@type': 'room'
 *     '@id': 'PartyChatRoom@muc.jabber.net',
 *   }
 * }
 *
 */
XMPP.prototype.join = function (job, done) {
  var self = this;
  self.session.connectionManager.get(job.actor['@id'], createObj, function (err, client) {
    if (err) { return done(err); }
    self.session.debug('got client for ' + job.actor['@id']);
    //
    // send join
    self.session.debug('sending join to ' + job.target['@id']);
    client.connection.join(
      job.target['@id']
      // optional passwords not handled for now
    );
    done();
  });
};


/**
 * Function: send
 *
 * Send a message to a room or private conversation.
 *
 * @example
 *
 * {
 *   context: 'xmpp',
 *   '@type': 'send',
 *   actor: {
 *     '@id': 'xmpp://slvrbckt@jabber.net/Home',
 *     '@type': 'person',
 *     displayName: 'Nick Jennings',
 *     userName: 'slvrbckt'
 *   },
 *   target: {
 *     '@id': 'xmpp://homer@jabber.net/Home',
 *     '@type': 'user',
 *     displayName: 'Homer'
 *   },
 *   object: {
 *     '@type': 'message',
 *     content: 'Hello from Sockethub!'
 *   }
 * }
 *
 */
XMPP.prototype.send = function (job, done) {
  var self = this;
  self.session.connectionManager.get(job.actor['@id'], createObj, function (err, client) {
    if (err) { return done(err); }
    self.session.debug('got client for ' + job.actor['@id']);
    //
    // send message
    self.session.debug('sending message to ' + job.target['@id']);
    client.connection.send(
      job.target['@id'],
      job.object.content
    );
    done();
  });
};


/**
 * Function: update
 *
 * @description
 * Indicate presence and status message.
 *
 * @example
 *
 * {
 *   context: 'xmpp',
 *   '@type': 'update',
 *   actor: {
 *     '@id': 'user@host.org/Home'
 *   },
 *   object: {
 *     '@type': 'presence'
 *     presence: 'chat',
 *     content: '...clever saying goes here...'
 *   }
 * }
 */
XMPP.prototype.update = function (job, done) {
  var self = this;
  self.session.connectionManager.get(job.actor['@id'], createObj, function (err, client) {
    if (err) { return done(err); }
    self.session.debug('got client for ' + job.actor['@id']);

    if (job.object['@type'] === 'presence') {
      var show = job.object.presence === 'available' ? 'chat' : job.object.show;
      var status = job.object.content || '';
      //
      // setting presence
      self.session.debug('setting presence: ' + show + ' status: ' + status);
      client.connection.setPresence(show, status);
      self.session.debug('requesting XMPP roster');
      client.connection.getRoster();
      /*if (job.object.roster) {
        _.session.log('requesting roster list');
        client.connection.getRoster();
      }*/
      done();
    } else {
      done('unknown object type (should be presence?): ' + job.object['@type']);
    }
  });
};

/**
 * Function: request-friend
 *
 * @description
 * Send friend request
 *
 * @example
 *
 * {
 *   context: 'xmpp',
 *   '@type': 'request-friend',
 *   actor: {
 *     '@id': 'user@host.org/Home'
 *   },
 *   target: {
 *     '@id': 'xmpp://homer@jabber.net/Home',
 *   }
 * }
 */
XMPP.prototype['request-friend'] = function (job, done) {
  var self = this;
  self.session.connectionManager.get(job.actor['@id'], createObj, function (err, client) {
    if (err) { return done(err); }
    self.session.debug('request friend ' + job.target['@id']);
    client.connection.subscribe(job.target['@id']);
  });
};

/**
 * Function: remove-friend
 *
 * @description
 * Send a remove friend request
 *
 * @example
 *
 * {
 *   context: 'xmpp',
 *   '@type': 'remove-friend',
 *   actor: {
 *     '@id': 'user@host.org/Home'
 *   },
 *   target: {
 *     '@id': 'xmpp://homer@jabber.net/Home',
 *   }
 * }
 */
XMPP.prototype['remove-friend'] = function (job, done) {
  var self = this;
  self.session.connectionManager.get(job.actor['@id'], createObj, function (err, client) {
    if (err) { return done(err); }
    self.session.debug('remove friend ' + job.target['@id']);
    client.connection.unsubscribe(job.target['@id']);
  });
};

/**
 * Function: make-friend
 *
 * @description
 * Confirm a friend request
 *
 * @example
 *
 * {
 *   context: 'xmpp',
 *   '@type': 'make-friend',
 *   actor: {
 *     '@id': 'user@host.org/Home'
 *   },
 *   target: {
 *     '@id': 'xmpp://homer@jabber.net/Home',
 *   }
 * }
 */
XMPP.prototype['make-friend'] = function (job, done) {
  var self = this;
  self.session.connectionManager.get(job.actor['@id'], createObj, function (err, client) {
    if (err) { return done(err); }
    self.session.debug('make friend ' + job.target['@id']);
    client.connection.acceptSubscription(job.target['@id']);
  });
};

/**
 * Function: observe
 *
 * @description
 * NOTE IMPLEMENTED YET
 *
 */
XMPP.prototype.observe = function () {};

XMPP.prototype.cleanup = function (done) {
  // FIXME
  this.session.debug('cleanup called, but nothing implemented');
  done();
};


//
// connection manager object for establishing XMPP connection (connect property), and handling incoming events (listeners property), and more.
//
var createObj = {
  timeout: 30000,
  connect: function (cb) {
    var self = this;
    self.scope.debug('calling connect for ' + self.credentials.actor['@id']);

    //
    // generate bareJid and fullJid
    var fullJid;
    if (self.credentials.object.username.indexOf('@') === -1) {
      fullJid = self.credentials.object.username + '@' + self.credentials.object.server + '/' + self.credentials.object.resource;
    } else {
      fullJid = self.credentials.object.username + '/' + self.credentials.object.resource;
    }

    //
    // credential object to pass to simple-xmpp
    var xmpp_creds = {
      jid: fullJid,
      password: self.credentials.object.password
    };
    if (self.credentials.object.server) {
      xmpp_creds.host = self.credentials.object.server;
    }
    if (self.credentials.port) {
      xmpp_creds.port = self.credentials.object.port;
    }

    var handlers = {
      error: function (error) {
        var msg = 'failed connecting ' + fullJid;
        msg = (error) ? msg + ' : ' + error : msg;
        self.scope.debug("connect error: " + error);
        xmpp.disconnect();
        cb(msg);
      },
      online: function () {
        self.scope.debug('connected with jid: ' + fullJid);
        xmpp.removeListener('online', handlers.online);
        xmpp.removeListener('error', handlers.error);
        xmpp.removeListener('close', handlers.close);
        cb(null, xmpp);
      },
      close: function () {
        // FIXME - not sure in what cases this happens
        self.scope.debug('close received for ' + fullJid);
        cb('received close event for '+ fullJid);
      }
    };

    xmpp.on('online', handlers.online);
    xmpp.on('error', handlers.error);
    xmpp.on('close', handlers.close);

    xmpp.connect(xmpp_creds);
    self.scope.debug('sent XMPP connect for account ' + fullJid);
  },
  listeners: {
    stanza: function (stanza) {
      this.scope.debug("got XMPP stanza... " + stanza);

      // simple-xmpp currently doesn't seem to handle error state presence
      // so we'll do it here for now.
      // TODO: consider moving this to simple-xmpp once it's ironed out and
      // proven to work well.
      if (stanza.is('presence') && (stanza.type === 'error')) {
        var error,
            message = stanza.toString(),
            type = 'update';

        if (error = stanza.getChild('error')) {
          message = error.toString();
          if (error.getChild('remote-server-not-found')) {
            // when we get this type of return message, we know it was a response from a join
            type = 'join';
            message = 'remote server not found ' + stanza.from;
          }
        }

        this.scope.send({
          '@type': type,
          actor: {
            '@id': stanza.from,
            '@type': 'room'
          },
          object: {
            '@type': 'error', // type error
            content: message.toString()
          },
          target: {
            '@id': stanza.to,
            '@type': 'person'
          }
        });
      } else if (stanza.is('iq')) {
        var query = stanza.getChild('query');
        if (query) {
          var entries = query.getChildren('item');
          for (var e in entries) {
            if (!entries.hasOwnProperty(e)) {
              continue;
            }
            this.scope.debug('STANZA ATTRS: ', entries[e].attrs);
            if (entries[e].attrs.subscription === 'both') {
              this.scope.send({
                '@type': 'update',
                actor: { '@id': entries[e].attrs.jid, displayName: entries[e].attrs.name },
                target: this.credentials.actor,
                object: {
                  '@type': 'presence',
                  status: '',
                  presence: state
                }
              });
            } else if ((entries[e].attrs.subscription === 'from') &&
                      (entries[e].attrs.ask) && (entries[e].attrs.ask === 'subscribe')) {
              this.scope.send({
                '@type': 'update',
                actor: { '@id': entries[e].attrs.jid, displayName: entries[e].attrs.name },
                target: this.credentials.actor,
                object: {
                  '@type': 'presence',
                  statusText: '',
                  presence: 'notauthorized'
                }
              });
            } else {
              /**
               * cant figure out how to know if one of these query stanzas are from
               * added contacts or pending requests
               */
              this.scope.send({
                '@type': 'request-friend',
                actor: { '@id': entries[e].attrs.jid, displayName: entries[e].attrs.name },
                target: this.credentials.actor
              });
            }
          }
        }
      }
    },
    chatstate: function (from, name) {
      this.scope.debug('received chatstate event: ' + from, name);
    },
    groupbuddy: function (id, groupBuddy, state, statusText) {
      this.scope.debug('received groupbuddy event: ' + id, groupBuddy, state, statusText);
    },
    buddyCapabilities: function (id, capabilities) {
      this.scope.debug('received buddyCapabilities: ' + id, capabilities);
    },
    chat: function (from, message) {
      this.scope.debug("received chat message from " + from);
      this.scope.send({
        '@type': 'send',
        actor: { '@id': from },
        target: this.credentials.actor,
        object: {
          content: message,
          id: nextId()
        }
      });
    },
    buddy: function (from, state, statusText) {
      if (from !== this.credentials.actor['@id']) {
        this.scope.debug('received buddy presence update: ' + from + ' - ' + state);
        this.scope.send({
          '@type': 'update',
          actor: { '@id': from },
          target: this.credentials.actor,
          object: {
            '@type': 'presence',
            status: statusText,
            presence: state
          }
        });
      }
    },
    subscribe: function (from) {
      this.scope.debug('received subscribe request from ' + from);
      this.scope.send({
        '@type': "request-friend",
        actor: { '@id': from },
        target: this.credentials.actor
      });
    },
    unsubscribe: function (from) {
      this.scope.debug('received unsubscribe request from ' + from);
      this.scope.send({
        '@type': "remove-friend",
        actor: { '@id': from },
        target: this.credentials.actor
      });
    },
    close: function () {
      this.scope.debug('received close event with no handler specified');
      this.scope.send({
        '@type': 'close',
        actor: this.credentials.actor,
        target: this.credentials.actor
      });
      this.scope.debug('**** xmpp session for ' + this.credentials.actor['@id'] + ' closed');
      this.connection.disconnect();
    },
    error: function (error) {
      try {
        this.scope.debug("*** XMPP ERROR (rl): " + error);
        this.scope.send({
          '@type': 'error',
          object: {
            '@type': 'error',
            content: error
          }
        });
      } catch (e) {
        this.scope.debug('*** XMPP ERROR (rl catch): ', e);
      }
    },
    online: function () {
      this.scope.debug('online');
      this.scope.debug('reconnectioned ' + this.credentials.actor['@id']);
    }
  },
  addListener: function (name, func) {
    this.connection.on(name, func);
  },
  removeListener: function (name) {
    this.connection.removeListener(name);
  },
  isConnected: function () {
    if (this.connection.STATUS === 'offline') {
      return false;
    } else {
      return true;
    }
  },
  disconnect: function (cb) {
    // FIXME - review this, simple-xmpp has a close func now i believe
    this.scope.debug('should be CLOSING connection now, NOT IMPLEMENTED in node-xmpp');
    this.scope.quit = true;
    this.connection.disconnect();
    cb();
  }
};

module.exports = XMPP;