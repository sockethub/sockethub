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
var Promise    = require('bluebird');

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
function IRC() {
  this.api = new IRCFactory.Api();
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
  "verbs" : [ 'update', 'join', 'leave', 'send', 'observe' ],
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
IRC.prototype.init = function (session) {
  this.session = session;
  this.sessionId = session.getSessionID();
  return Promise.resove();
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
 *         displayName: 'Nick Jennings',
 *         userName: 'slvrbckt'
 *       },
 *       target: [
 *         {
 *           id: 'irc://irc.freenode.net/sockethub',
 *           objectType: 'chatroom',
 *           displayName: '#sockethub'
 *         },
 *         {
 *           id: 'irc://irc.freenode.net/remotestorage',
 *           objectType: 'chatroom',
 *           displayName: '#remotestorage'
 *         }
 *       ],
 *       object: {}
 *     }
 *     (end code)
 *
 */
IRC.prototype.join = function (job) {
  var self = this;

  self.session.debug('join() called');

  if ((typeof job.target[0] !== 'object') || (typeof job.target[0].address !== 'string')) {
    return Promise.reject('no targets to join!');
  }

  var pending = Promise.defer();

  self._getClient(job).then(function (client) {
    self.session.debug('got client for ' + job.actor.address);
    job.target.forEach(function (t) {
      // join channel
      self.session.debug('join: ' + job.actor.address + ' -> ' + t.address);
      client.conn.irc.raw(['JOIN', t.address]);
      pending.resolve();
    });
  }, pending.reject).fail(pending.reject);

  return pending.promise;
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
 *         displayName: 'Nick Jennings',
 *         userName: 'slvrbckt'
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
IRC.prototype.leave = function (job) {
  var self = this;

  self.session.debug('leave() called');

  if ((typeof job.target[0] !== 'object') || (typeof job.target[0].address !== 'string')) {
    return Promise.reject('no targets to leave!');
  }

  var pending = Promise.defer();

  self._getClient(job).then(function (client) {
    job.target.forEach(function (t) {
      // leave channel
      self.session.debug('leave: ' + job.actor.address + ' -< ' + t.address);
      client.conn.irc.raw(['PART', t.address]);
    });
    pending.resolve();
  }, pending.reject).fail(pending.reject);

  return pending.promise;
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
IRC.prototype.send = function (job) {
  var self = this;

  self.session.debug('send() called for ' + job.actor.address + ' target: ' + job.target[0].address);

  var pending = Promise.defer();

  self._getClient(job).then(function (client) {
    self.session.debug('send(): got client object');
    var msg = job.object.text.replace(/^\s+|\s+$/g, "");
    self.session.debug('irc.say: ' + job.target[0].address + ', [' + msg + ']');

    client.conn.irc.raw(['PRIVMSG', job.target[0].address, '' + msg]);
    pending.resolve();
  }, pending.reject).fail(pending.reject);

  return pending.promise;
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
 *         objectType: 'address'
 *       },
 *       target: [
 *         {
 *           address: 'CoolDude'
 *         }
 *       ]
 *     }
 *     (end code)
 */
IRC.prototype.update = function (job) {
  var self = this;

  self.session.debug('update() called for ' + job.actor.address);

  if ((typeof job.target[0] !== 'object') || (typeof job.target[0].address !== 'string')) {
    return Promise.reject('no targets specified');
  } else if (typeof job.object.objectType !== 'string') {
    return Promise.reject('object.objectType property required');
  }

  var pending = Promise.defer();

  self._getClient(job).then(function (client) {
    self.session.debug('update(): got client object');
    if (job.object.objectType === 'address') {
      self.session.debug('changing nick from ' + job.actor.address + ' to ' + job.target[0].address);
      // send nick change command
      client.conn.irc.raw(['NICK', job.target[0].address]);

      // preserve old creds
      var oldCreds = JSON.parse(JSON.stringify(client.credentials));
      var newCreds = JSON.parse(JSON.stringify(client.credentials));

      // set new credentials
      newCreds.object.nick   = job.target[0].address;
      newCreds.actor.address = job.target[0].address;
      newCreds.actor.name    = job.target[0].name || client.credentials.actor.name || '';

      self.session.setConfig('credentials', job.target[0].address, newCreds);

      // reset index of client object in clientManager
      self.session.clientManager.move(client.key,
                                      oldCreds,
                                      job.target[0].address + '@' + newCreds.object.server,
                                      newCreds);
    } else if (job.object.objectType === 'topic') {
      // update topic
      self.session.debug('changing topic in channel ' + job.target[0].address);
      client.conn.irc.raw(['topic', job.target[0].address, job.object.topic]);
    }
    pending.resolve();
  }, pending.reject).fail(pending.reject);

  return pending.promise;
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
IRC.prototype.observe = function (job) {
  var self = this;

  self.session.debug('observe() called for ' + job.actor.address);

  if ((typeof job.target[0] !== 'object') || (typeof job.target[0].address !== 'string')) {
    return Promise.reject('no targets specified');
  } else if (typeof job.object.objectType !== 'string') {
    return Promise.reject('object.objectType property required');
  }

  var pending = Promise.defer();

  self._getClient(job).then(function (client) {
    self.session.debug('observe(): got client object');
    if (job.object.objectType === 'attendance') {
      job.target.forEach(function (t) {
        self.session.debug('objserve() - sending NAMES for ' + t.address);
        client.conn.irc.raw(['NAMES', t.address]);
      });
      pending.resolve();
    } else {
      pending.reject("unknown objectType '" + job.object.objectType + "'");
    }
  }, pending.reject).fail(pending.reject);

  return pending.promise;
};


IRC.prototype.cleanup = function (job) {
  // TODO - destroy IRC connection
  return Promise.resolve();
};


IRC.prototype._getClient = function (job, create) {
  var self = this,
      pending = Promise.defer();

  create = (typeof create === 'boolean') ? create : true;

  //
  // get credentials
  self.session.getConfig('credentials', job.actor.address).then(function (creds) {
    self.session.debug('got config for ' + job.actor.address);
    var client_lookup = job.actor.address + '@' + creds.object.server;

    //
    // check if client object already exists
    var client = self.session.clientManager.get(client_lookup, creds);

    if ((!client) && (create)) {
      //
      // create a client
      return self._createClient(client_lookup, creds).then(pending.resolve, pending.reject).fail(pending.reject);

    } else if (client) {
      //
      // client already exists
      self.session.info('returning existing client ' + client.id);

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

  self.session.info('creating new client connection to ' + creds.object.server);

  self.session.clientManager.create(key, creds, {
    timeout: 10000,
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
        self.session.info('connected to ' + credentials.object.server);
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
            console.log('received UNKNOWN: ', object);
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
      console.log('removeListener called!');
      self.session.debug('removeListener called!');
      self.api.unhookEvent(key, name);
    },
    disconnect: function (client, key, cb) {
      self.session.info('irc disconnect for ' + key);
      client.conn.irc.disconnect();
      cb();
    }
  },
  function (err, client) {
    //console.log('COMPLETED ', client);
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
