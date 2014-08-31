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

var Q = require('q');
if (typeof (IRCFactory) !== 'object') {
  IRCFactory = require('irc-factory');
}

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
 * JSON schema defining the credentials which are passed during the 'set'
 * verb. Actual handling of incoming 'set' commands are handled by dispatcher,
 * but the dispatcher uses this defined schema to validate credentials
 * received, so that when a platform verb is called, it can fetch the
 * credentials (`session.getConfig()`), knowing they will have already been
 * validated against this schema.
 *
 * Example valid AS object for setting IRC credentials:
 *
 *   (start code)
 *   {
 *     verb: 'set',
 *     platform: 'dispatcher', // dispatcher handles validating incoming credentials
 *     actor: {
 *       address: 'testuser',
 *       name: 'Dr. Test User'
 *     },
 *     object: {
 *       objectType: 'credentials',
 *       server: 'irc.host.net',
 *       nick: 'testuser',
 *       password: 'asdasdasdasd'
 *     },
 *     target: [
 *       {
 *         platform: 'irc'  // indicates which platform the credentials are for
 *       }
 *     ]
 *   }
 *   (end code)
 */
IRC.prototype.schema = {
  "set": {
    "credentials" : {
      "required": ['object'],
      "properties": {
        "object": {
          "name": "object",
          "type": "object",
          "required": ['objectType', 'nick', 'server'],
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
            }
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
  var q = Q.defer();
  q.resolve();
  return q.promise;
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
 *       platform: 'irc',
 *       verb: 'join',
 *       actor: {
 *         address: 'slvrbckt'
 *       },
 *       target: [
 *         {
 *           address: '#sockethub'
 *         },
 *         {
 *           address: '#remotestorage'
 *         }
 *       ],
 *       object: {},
 *       rid: 1234
 *     }
 *     (end code)
 *
 */
IRC.prototype.join = function (job) {
  var session = this.session,
      sessionId = this.sessionId,
      self = this,
      q = Q.defer();

  session.debug('join() called');

  if ((typeof job.target[0] !== 'object') || (typeof job.target[0].address !== 'string')) {
    q.reject('no targets to join!');
    return q.promise;
  }
  self._getClient(job).then(function (client) {
    session.debug('got client for '+job.actor.address);
    job.target.forEach(function (t) {
      // join channel
      session.debug('join: ' + job.actor.address + ' -> ' + t.address);
      client.conn.irc.raw(['JOIN', t.address]);
      q.resolve();
    });
  }, q.reject).fail(q.reject);
  return q.promise;
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
 *       platform: 'irc',
 *       verb: 'leave',
 *       actor: {
 *         address: 'slvrbckt'
 *       },
 *       target: [
 *         {
 *           address: '#remotestorage'
 *         }
 *       ],
 *       object: {},
 *       rid: 1234
 *     }
 *     (end code)
 *
 */
IRC.prototype.leave = function (job) {
  var session = this.session,
      sessionId = this.sessionId,
      self = this,
      q = Q.defer();

  session.debug('leave() called');

  if ((typeof job.target[0] !== 'object') || (typeof job.target[0].address !== 'string')) {
    q.reject('no targets to leave!');
    return q.promise;
  }

  self._getClient(job).then(function (client) {
    job.target.forEach(function (t) {
      // leave channel
      session.debug('leave: ' + job.actor.address + ' -< ' + t.address);
      client.conn.irc.raw(['PART', t.address]);
    });
    q.resolve();
  }, q.reject).fail(q.reject);
  return q.promise;
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
 *       platform: 'irc',
 *       verb: 'send',
 *       actor: {
 *         address: 'slvrbckt'
 *       },
 *       target: [
 *         {
 *           address: '#sockethub'
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
IRC.prototype.send = function (job) {
  var session = this.session,
      sessionId = this.sessionId,
      self = this,
      q = Q.defer();

  session.debug('send() called for ' + job.actor.address + ' target: ' + job.target[0].address);

  self._getClient(job).then(function (client) {
    session.debug('send(): got client object');
    var msg = job.object.text.replace(/^\s+|\s+$/g, "");
    session.debug('irc.say: ' + job.target[0].address+', ['+ msg+']');

    client.conn.irc.raw(['PRIVMSG', job.target[0].address, ':'+msg]);
    q.resolve();
  }, q.reject).fail(q.reject);

  return q.promise;
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
 *         address: 'slvrbckt'
 *       },
 *       target: [
 *         {
 *           address: '#sockethub'
 *         }
 *       ],
 *       object: {
 *         objectType: 'topic',
 *         topic: 'New version of Socekthub released!'
 *       },
 *       rid: 1234
 *     }
 *     (end code)
 *
 * - change nickname
 *
 *     (start code)
 *     {
 *       platform: 'irc',
 *       verb: 'udpate',
 *       actor: {
 *         address: 'slvrbckt'
 *       },
 *       object: {
 *         objectType: 'address'
 *       },
 *       target: [
 *         {
 *           address: 'CoolDude'
 *         }
 *       ],
 *       rid: 1234
 *     }
 *     (end code)
 */
IRC.prototype.update = function (job) {
  var session = this.session,
      sessionId = this.sessionId,
      self = this,
      q = Q.defer();

  session.debug('update() called for ' + job.actor.address);

  if ((typeof job.target[0] !== 'object') || (typeof job.target[0].address !== 'string')) {
    q.reject('no targets specified');
    return q.promise;
  } else if (typeof job.object.objectType !== 'string') {
    q.reject('object.objectType property required');
    return q.promise;
  }

  self._getClient(job).then(function (client) {
    session.debug('update(): got client object');
    if (job.object.objectType === 'address') {
      session.debug('changing nick from ' + job.actor.address + ' to ' + job.target[0].address);
      // send nick change command
      client.conn.irc.raw(['NICK', job.target[0].address]);

      // preserve old creds
      var oldCreds = JSON.parse(JSON.stringify(client.credentials));
      var newCreds = JSON.parse(JSON.stringify(client.credentials));

      // set new credentials
      newCreds.object.nick = job.target[0].address;
      newCreds.actor.address = job.target[0].address;
      newCreds.actor.name = job.target[0].name || client.credentials.actor.name || '';

      session.setConfig('credentials', job.target[0].address, newCreds);

      // reset index of client object in clientManager
      session.clientManager.move(client.key,
                                 oldCreds,
                                 job.target[0].address + '@' + newCreds.object.server,
                                 newCreds);
    } else if (job.object.objectType === 'topic') {
      // update topic
      session.debug('changing topic in channel ' + job.target[0].address);
      client.conn.irc.raw(['topic', job.target[0].address, job.object.topic]);
    }
    q.resolve();
  }, q.reject).fail(q.reject);

  return q.promise;
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
 *       platform: 'irc',
 *       verb: 'observe',
 *       actor: {
 *         address: 'slvrbckt'
 *       },
 *       target: [
 *         {
 *           address: '#sockethub'
 *         }
 *       ],
 *       object: {
 *         objectType: 'attendance'
 *       },
 *       rid: 1234
 *     }
 *     (end code)
 *
 *   The obove object might return:
 *
 *     (start code)
 *     {
 *       platform: 'irc',
 *       verb: 'observe',
 *       actor: {
 *         address: '#sockethub'
 *       },
 *       target: [],
 *       object: {
 *         objectType: 'attendance'
 *         members: [
 *           'RyanGosling',
 *           'PeeWeeHerman',
 *           'Commando',
 *           'Smoochie',
 *           'neo'
 *         ]
 *       },
 *       rid: 1234
 *     }
 *     (end code)
 *
 */
IRC.prototype.observe = function (job) {
  var session = this.session,
      sessionId = this.sessionId,
      self = this,
      q = Q.defer();

  session.debug('observe() called for ' + job.actor.address);

  if ((typeof job.target[0] !== 'object') || (typeof job.target[0].address !== 'string')) {
    q.reject('no targets specified');
    return q.promise;
  } else if (typeof job.object.objectType !== 'string') {
    q.reject('object.objectType property required');
    return q.promise;
  }

  self._getClient(job).then(function (client) {
    session.debug('observe(): got client object');
    if (job.object.objectType === 'attendance') {
      job.target.forEach(function (t) {
        session.debug('objserve() - sending NAMES for ' + t.address);
        client.conn.irc.raw(['NAMES', t.address]);
      });
      q.resolve();
    } else {
      q.reject("unknown objectType '" + job.object.objectType + "'");
    }
  }, q.reject).fail(q.reject);

  return q.promise;
};

IRC.prototype.cleanup = function (job) {
  var session = this.session,
      sessionId = this.sessionId,
      self = this,
      q = Q.defer();

  q.resolve();
  return q.promise;
};


IRC.prototype._getClient = function (job, create) {
  var session = this.session,
      self = this,
      q = Q.defer();

  create = (typeof create === 'boolean') ? create : true;
  //
  // get credentials
  session.getConfig('credentials', job.actor.address).then(function (creds) {
    session.debug('got config for ' + job.actor.address);
    var client_lookup = job.actor.address + '@' + creds.object.server;
    //
    // check if client object already exists
    var client = session.clientManager.get(client_lookup, creds);
    if ((!client) && (create)) {
      //
      // create a client
      return self._createClient(client_lookup, creds).then(q.resolve, q.reject).fail(q.reject);

    } else if (client) {
      //
      // client already exists
      session.info('returning existing client ' + client.id);
      // make sure we have listeners for this session
      //
      // XXX TODO FIXME - make sure we know how to re-load listeners for a new
      // session.
      //
      // if (!client.listeners.message[self.sessionId]) {
      //   client.listeners = mergeListeners(client, self._registerListeners(client));
      // }
      q.resolve(client);
    } else {
      //
      // no existing client and do not create a new one
      q.reject();
    }
  });
  return q.promise;
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
  var session = this.session,
      sessionId = this.sessionId,
      self = this,
      q = Q.defer();

  session.info('creating new client connection to ' + creds.object.server);

  session.clientManager.create(key, creds, {
    timeout: 10000,
    connect: function (key, credentials, cb) {
      this.session.debug('connect called!');
      var _this = this;
      var client;

      var module_creds = {
        nick: credentials.object.nick,
        user: credentials.actor.name || '',
        server: credentials.object.server || 'irc.freenode.net',
        realname: credentials.actor.name || '',
        port: 6667,
        secure: false
      };

      function onRegister(object) {
        _this.session.info('connected to ' + creds.object.server);
        //console.log('CLIENT: ', client);
        //console.log('client.conn: '+typeof client.conn);
        //session.clientManager.add(client.id, client);
        self.api.unhookEvent(key, 'registered');
        cb(null, client);
      }

      self.api.unhookEvent(key, '*');
      self.api.hookEvent(key, 'registered', onRegister);

      // connect...
      client = self.api.createClient(key, module_creds);
    },
    listeners: {
      '*': function (object) {
        if (typeof object.names === 'object') {
          // user list
          this.session.debug('received user list: ' + object.channel);
          this.session.send({
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
          this.session.debug('received topic change list: ' + object.channel + ':'+object.topicBy+': '+ object.topic);
          this.session.send({
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
          this.session.debug('received nick change ' + object.nickname + ' -> ' + object.newnick);
          this.session.send({
            verb: 'update',
            actor: { address: object.nickname },
            target: [{ address: object.newnick }],
            object: {
              'objectType': 'address'
            }
          });
        } else if (typeof object.channel === 'string') {
          // join
          this.session.debug('received join: ' + object.nickname + ' -> ' + object.channel, object);
          if (!object.nickname) {
            this.session.debug('skipping join message with undefined nickname');
          } else {
            this.session.send({
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
            this.session.debug('received message: ' + object.nickname + ' -> ' + object.target);
            this.session.send({
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
          this.session.debug('received quit: ' + object.nickname + ' -> ' + object.target, object);
          this.session.send({
            verb: 'leave',
            actor: { address: object.nickname },
            target: [],
            object: {
              text: object.message
            }
          });
        } else {
          //this.session.log('INCOMING IRC OBJECT: ', object);
        }
      }
    },
    addListener: function (client, key, name, func) {
      this.session.debug('addListener called! '+key+' '+name);
      self.api.hookEvent(key, name, func);
    },
    removeListener: function (client, key, name, func) {
      console.log('removeListener called!');
      this.session.debug('removeListener called!');
      self.api.unhookEvent(key, name);
    },
    disconnect: function (client, key, cb) {
      this.session.info('irc disconnect for ' + key);
      client.conn.irc.disconnect();
      cb();
    }
  },
  function (err, client) {
    //console.log('COMPLETED ', client);
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
  return new IRC();
};