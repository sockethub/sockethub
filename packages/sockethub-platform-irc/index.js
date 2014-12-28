/**
 * This file is part of sockethub.
 *
 * copyright 2012-2015 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the LGPLv3.
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

if (typeof (IRCFactory) !== 'object') {
  IRCFactory = require('irc-factory');
}

var Promise = require('bluebird');

Promise.defer = function () {
  var resolve, reject;
  var promise = new Promise(function() {
    resolve = arguments[0];
    reject = arguments[1];
  });
  return {
      resolve: resolve,
    reject: reject,
    promise: promise
  };
};



/**
 * Class: IRC
 *
 * Handles all actions related to communication via. the IRC protocol.
 *
 * Uses the `irc-factory` node module as a base tool for interacting with IRC.
 *
 * https://github.com/ircanywhere/irc-factory
 *
 */
function IRC(session) {
  this.api = new IRCFactory.Api();
  this.session = session;
}

/**
 * Property: schema
 *
 * JSON schema defining the verbs this platform accepts, and the credentials
 * object which is passed during the 'set' verb.
 *
 * Actual handling of incoming 'set' commands are handled by dispatcher,
 * but the dispatcher uses this defined schema to validate credentials
 * received, so that when a platform verb is called, it can fetch the
 * credentials (`session.getConfig()`), knowing they will have already been
 * validated against this schema.
 *
 * Example valid AS object for setting IRC credentials:
 *
 *   (start code)
 *   {
 *     id: 1234,
 *     verb: 'set',
 *     platform: 'irc',
 *     actor: {
 *       id: 'irc://testuser@irc.host.net',
 *       objectType: 'person',
 *       displayName: 'Mr. Test User',
 *       userName: 'testuser'
 *     },
 *     object: {
 *       objectType: 'credentials',
 *       server: 'irc.host.net',
 *       nick: 'testuser',
 *       password: 'asdasdasdasd',
 *       port: 6697,
 *       secure: true
 *     }
 *   }
 *   (end code)
 *
 * In the above example, sockethub will validate the incoming credentials object
 * against whatever is defined in the `credentials` portion of the schema
 * object.
 *
 * It will also check if the incoming AS object uses a verb which exists in the
 * `verbs` portion of the schema object (should be an array of verb names).
 */
IRC.prototype.schema = {
  "messages" : {
    "required": [ 'verb' ],
    "properties": {
      "verb": {
        "enum": [ 'update', 'join', 'leave', 'send', 'observe' ]
      }
    }
  },
  "credentials" : {
    "required": [ 'object' ],
    "properties": {
      "object": {
        "name": "object",
        "type": "object",
        "required": [ 'objectType', 'nick', 'server' ],
        "additionalProperties": false,
        "properties" : {
          "objectType": {
            "name": "objectType",
            "type": "string"
          },
          "nick" : {
            "name" : "nick",
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
          "secure": {
            "name": "secure",
            "type": "boolean"
          }
        }
      }
    }
  }
};

/**
 * Function: join
 *
 * Join a room or private conversation.
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
 *     (start code)
 *     {
 *       id: 1234,
 *       platform: 'irc',
 *       verb: 'join',
 *       actor: {
 *         id: 'irc://slvrbckt@irc.freenode.net',
 *         objectType: 'person',
 *         displayName: 'slvrbckt'
 *       },
 *       target: {
 *         id: 'irc://irc.freenode.net/sockethub',
 *         objectType: 'chatroom',
 *         displayName: '#sockethub'
 *       },
 *       object: {}
 *     }
 *     (end code)
 *
 */
IRC.prototype.join = function (job, done) {
  var self = this;

  self.session.debug('join() called');

  var pending = Promise.defer();

  self._getClient(job).then(function (client) {
    if (err) { return done(err); }
    self.session.debug('got client for ' + job.actor.id);
    // join channel
    self.session.debug('join: ' + job.actor.displayName + ' -> ' + job.target.displayName);
    client.conn.irc.raw(['JOIN', job.target.displayName]);
    done();
  }, done);
};

/**
 * Function: leave
 *
 * Leave a room or private conversation.
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
 *     (start code)
 *     {
 *       id: 1234,
 *       platform: 'irc',
 *       verb: 'leave',
 *       actor: {
 *         id: 'irc://slvrbckt@irc.freenode.net',
 *         objectType: 'person',
 *         displayName: 'slvrbckt'
 *       },
 *       target: {
 *         id: 'irc://irc.freenode.net/remotestorage',
 *         objectType: 'chatroom',
 *         displayName: '#remotestorage'
 *       },
 *       object: {}
 *     }
 *     (end code)
 *
 */
IRC.prototype.leave = function (job, done) {
  var self = this;

  self.session.debug('leave() called');

  self._getClient(job).then(function (client) {
    // leave channel
    self.session.debug('leave: ' + job.actor.displayName + ' -< ' + t.displayName);
    client.conn.irc.raw(['PART', t.displayName]);
    done();
  }, done);
};

/**
 * Function: send
 *
 * Send a message to a room or private conversation.
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
 *     (start code)
 *     {
 *       id: 1234,
 *       platform: 'irc',
 *       verb: 'send',
 *       actor: {
 *         id: 'irc://slvrbckt@irc.freenode.net',
 *         objectType: 'person',
 *         displayName: 'Nick Jennings',
 *         userName: 'slvrbckt'
 *       },
 *       target: {
 *         id: 'irc://irc.freenode.net/remotestorage',
 *         objectType: 'chatroom',
 *         displayName: '#remotestorage'
 *       },
 *       object: {
 *         objectType: 'message',
 *         content: 'Hello from Sockethub!'
 *       }
 *     }
 *     (end code)
 *
 */
IRC.prototype.send = function (job, done) {
  var self = this;

  self.session.debug('send() called for ' + job.actor.id + ' target: ' + job.target.id);

  self._getClient(job).then(function (client) {
    self.session.debug('send(): got client object');
    var msg = job.object.content.replace(/^\s+|\s+$/g, "");
    self.session.debug('irc.say: ' + job.target.displayName + ', [' + msg + ']');

    client.conn.irc.raw(['PRIVMSG', job.target.displayName, '' + msg]);
    done();
  }).catch(done);
};

/**
 * Function: update
 *
 * Indicate a change (ie. room topic update, or nickname change).
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
 * - change topic
 *
 *     (start code)
 *     {
 *       platform: 'irc',
 *       verb: 'update',
 *       actor: {
 *         id: 'irc://slvrbckt@irc.freenode.net',
 *         objectType: 'person',
 *         displayName: 'Nick Jennings',
 *         userName: 'slvrbckt'
 *       },
 *       target: {
 *         id: 'irc://irc.freenode.net/sockethub',
 *         objectType: 'chatroom',
 *         displayName: '#sockethub'
 *       },
 *       object: {
 *         objectType: 'topic',
 *         topic: 'New version of Socekthub released!'
 *       },
 *       id: 1234
 *     }
 *     (end code)
 *
 * - change nickname  TODO review, also when we rename a user, their person
 *                    object needs to change (and their credentials)
 *
 *     (start code)
 *     {
 *       id: 1234,
 *       platform: 'irc',
 *       verb: 'udpate',
 *       actor: {
 *         id: 'irc://slvrbckt@irc.freenode.net',
 *         objectType: 'person',
 *         displayName: 'Nick Jennings',
 *         userName: 'slvrbckt'
 *       },
 *       object: {
 *         objectType: 'displayName'
 *       },
 *       target: {
*           objectType: "person",
*           displayName: 'CoolDude'
*         }
 *     }
 *     (end code)
 */
IRC.prototype.update = function (job, done) {
  var self = this;

  self.session.debug('update() called for ' + job.actor.displayName);

  self._getClient(job).then(function (client) {
    self.session.debug('update(): got client object');

    if (job.object.objectType === 'address') {
      self.session.debug('changing nick from ' + job.actor.displayName + ' to ' + job.target.displayName);
      // send nick change command
      client.conn.irc.raw(['NICK', job.target.displayName]);

      // preserve old creds
      var oldCreds = JSON.parse(JSON.stringify(client.credentials));
      var newCreds = JSON.parse(JSON.stringify(client.credentials));

      // set new credentials
      newCreds.object.nick       = job.target.displayName;
      newCreds.actor.displayName = job.target.displayName;
      newCreds.actor.name        = job.target.displayName || client.credentials.actor.name || '';

      self.session.setConfig('credentials', job.target.displayName, newCreds);

      // reset index of client object in connection manager
      self.session.connection.move(client.key,
                                      oldCreds,
                                      job.target.displayName + '@' + newCreds.object.server,
                                      newCreds);

    } else if (job.object.objectType === 'topic') {
      // update topic
      self.session.debug('changing topic in channel ' + job.target.displayName);
      client.conn.irc.raw(['topic', job.target.displayName, job.object.topic]);
    }

    done();
  }, done);

};

/**
 * Function: observe
 *
 * Indicate an intent to observe something (ie. get a list of users in a room).
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
 *     (start code)
 *     {
 *       id: 1234,
 *       platform: 'irc',
 *       verb: 'observe',
 *       actor: {
 *         id: 'irc://slvrbckt@irc.freenode.net',
 *         objectType: 'person',
 *         displayName: 'Nick Jennings',
 *         userName: 'slvrbckt'
 *       },
 *       target: {
 *         id: 'irc://irc.freenode.net/sockethub',
 *         objectType: 'chatroom',
 *         displayName: '#sockethub'
 *       },
 *       object: {
 *         objectType: 'attendance'
 *       }
 *     }
 *     (end code)
 *
 *   The obove object might return:
 *
 *     (start code)
 *     {
 *       id: 1234,
 *       platform: 'irc',
 *       verb: 'observe',
 *       actor: {
 *         id: 'irc://irc.freenode.net/sockethub',
 *         objectType: 'chatroom',
 *         displayName: '#sockethub'
 *       },
 *       target: {},
 *       object: {
 *         objectType: 'attendance'
 *         members: [
 *           'RyanGosling',
 *           'PeeWeeHerman',
 *           'Commando',
 *           'Smoochie',
 *           'neo'
 *         ]
 *       }
 *     }
 *     (end code)
 *
 */
IRC.prototype.observe = function (job, done) {
  var self = this;

  self.session.debug('observe() called for ' + job.actor.address);

  self._getClient(job).then(function (client) {
    self.session.debug('observe(): got client object');
    if (job.object.objectType === 'attendance') {
      self.session.debug('objserve() - sending NAMES for ' + job.target.displayName);
      client.conn.irc.raw(['NAMES', job.target.displayName]);
      done();
    } else {
      done("unknown objectType '" + job.object.objectType + "'");
    }
  }, done);

};


IRC.prototype.cleanup = function (job, done) {
  // TODO - derefence IRC connection to lower the count
  done();
};


IRC.prototype._getClient = function (job, create) {
  var self = this,
      pending = Promise.defer();

  create = (typeof create === 'boolean') ? create : true;

  //
  // get credentials
  self.session.store.get(job.actor.id, function (err, creds) {
    if (err) { return promise.reject(err); }

    self.session.debug('got config for ' + job.actor.id);

    //
    // check if client object already exists
    var client = self.session.connection.get(job.actor.id, creds);

    if ((!client) && (create)) {
      //
      // create a client
      return self._createClient(job.actor.id, creds).catch(function (err) {console.log('err',err); pending.reject(err);});

    } else if (client) {
      //
      // client already exists
      self.session.debug('returning existing client ' + client.id);

      // make sure we have listeners for this session
      //
      // TODO FIXME - make sure we know how to re-load listeners for a new
      // session.
      //
      // if (!client.listeners.message[self.sessionId]) {
      //   client.listeners = mergeListeners(client, self._registerListeners(client));
      // }
      pending.resolve(client);
    } else {
      //
      // no existing client and do not create a new one
      pending.reject();
    }
  });
  return pending.promise;
};


/**
 * Function: _createClient
 *
 * This function is a wrapper for calling the <ClientManager> function which
 * is accessible within the <PlatformSession> object
 *
 * Parameters:
 *
 *   key   - [type/description]
 *   creds - [type/description]
 *
 * Returns:
 *
 *   return description
 */
IRC.prototype._createClient = function (key, creds) {
  var self = this,
      pending = Promise.defer();

  self.session.debug('creating new client connection to ' + creds.object.server, creds);

  self.session.connection.create({
    timeout: 10000,
    credentials: creds,
    connect: function (key, credentials, cb) {
      var _this = this;
      var client;

      var is_secure = (typeof credentials.object.secure === 'boolean') ? credentials.object.secure : true;
      var module_creds = {
        nick: credentials.object.nick,
        user: credentials.object.nick,
        server: credentials.object.server || 'irc.freenode.net',
        realname: credentials.actor.name || credentials.object.nick,
        secure: is_secure,
        port: (credentials.object.port) ? parseInt(credentials.object.port, 10) : (is_secure) ? 6697 : 6667,
      };

      function onRegister(object) {
        self.session.debug('connected to ' + credentials.object.server);
        self.api.unhookEvent(key, 'registered');
        cb(null, client);
      }
      self.api.unhookEvent(key, '*');

      self.api.hookEvent(key, '*', function (message) {
          self.session.debug(JSON.stringify(message));
      });

      self.api.hookEvent(key, 'registered', onRegister);

      self.session.debug('attempting to connect to ' + module_creds.server + ':' + module_creds.port + ' [secure:' + is_secure + ']');

      // connect...
      client = self.api.createClient(key, module_creds);
    },
    listeners: {
      '*': function (object) {
        if (typeof object.names === 'object') {
          // user list
          self.session.debug('received user list: ' + object.channel);
          self.session.send({
            verb: 'observe',
            actor: { address: object.channel },
            target: [{ address: object.channel }],
            object: {
              'objectType': 'attendance',
              members: object.names
            }
          });
        } else if ((typeof object.channel === 'string') &&
                   (typeof object.who === 'object')) {
          // full who
        } else if ((typeof object.topic === 'string') &&
                   (typeof object.topicBy === 'string')) {
          // topic
          self.session.debug('received topic change list: ' + object.channel + ':' + object.topicBy + ': ' + object.topic);
          self.session.send({
            verb: 'update',
            actor: { address: object.topicBy },
            target: [{ address: object.channel }],
            object: {
              'objectType': 'topic',
              topic: object.topic
            }
          });
        } else if (typeof object.newnick === 'string') {
          // nick change
          self.session.debug('received nick change ' + object.nickname + ' -> ' + object.newnick);
          self.session.send({
            verb: 'update',
            actor: { address: object.nickname },
            target: [{ address: object.newnick }],
            object: {
              'objectType': 'address'
            }
          });
        } else if ((typeof object.channel === 'string') &&
                   (object.raw.indexOf(' JOIN ') >= 0)) {
          // join
          self.session.debug('received join: ' + object.nickname + ' -> ' + object.channel, object);
          if (!object.nickname) {
            self.session.debug('skipping join message with undefined nickname');
          } else {
            self.session.send({
              verb: 'join',
              actor: { address: object.nickname },
              target: [{ address: object.channel }],
              object: {}
            });
          }
        } else if ((typeof object.target === 'string') &&
                   (typeof object.message === 'string')) {
          // message
          if (!object.nickname) {
            self.session.debug('received UNKNOWN: ', object);
          } else {
            self.session.debug('received message: ' + object.nickname + ' -> ' + object.target);
            self.session.send({
              verb: 'send',
              actor: { address: object.nickname },
              target: [{ address: object.target }],
              object: {
                text: object.message
              }
            });
          }
        } else if (typeof object.motd === 'object') {
          // skip
        } else if (typeof object.mode === 'string') {
          // skip
        } else if ((typeof object.nickname === 'string') &&
                   (typeof object.target === 'undefined')) {
          // QUIT
          self.session.debug('received quit: ' + object.nickname + ' -> ' + object.target, object);
          self.session.send({
            verb: 'leave',
            actor: { address: object.nickname },
            target: [{ address: '' }],
            object: {
              text: 'user has quit'
            }
          });
        } else if ((typeof object.channel === 'string') &&
                   (object.raw.indexOf(' PART ') >= 0)) {
          // leave
          self.session.debug('received leave: ' + object.nickname + ' -> ' + object.target, object);
          self.session.send({
            verb: 'leave',
            actor: { address: object.nickname },
            target: [{ address: object.target }],
            object: {
              text: 'user has left the channel'
            }
          });
        // } else {
        //   self.session.log('INCOMING IRC OBJECT: ', object);
        }
      }
    },
    addListener: function (client, key, name, func) {
      self.session.debug('addListener called! ' + key + ' ' + name);
      self.api.hookEvent(key, name, func);
    },
    removeListener: function (client, key, name, func) {
      self.session.debug('removeListener called!');
      self.api.unhookEvent(key, name);
    },
    disconnect: function (client, key, cb) {
      self.session.debug('irc disconnect for ' + key);
      client.conn.irc.disconnect();
      cb();
    }
  },
  function (err, client) {
    // completed
    if (err) {
      pending.reject(err);
    } else {
      pending.resolve(client);
    }
  });

  return pending.promise;
};


module.exports = IRC;
