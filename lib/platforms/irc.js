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
var IRCFactory = require('irc-factory');

/**
 * Constructor: IRC
 *
 * Uses the `irc-factory` node module as a base tool for interacting with IRC.
 * https://github.com/ircanywhere/irc-factory
 *
 */
function IRC() {
  this.api = new IRCFactory.Api();
}

IRC.prototype = {
  schema: {
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
                  "additionalProperties": false,
                  "properties" : {
                    "name" : {
                      "name" : "name",
                      "required" : false,
                      "type": "string"
                    },
                    "address" : {
                      "name" : "address",
                      "required" : false,
                      "type": "string"
                    }
                  }
                },
                "nick" : {
                  "name" : "nick",
                  "required" : true,
                  "type": "string"
                },
                "password" : {
                  "name" : "password",
                  "required" : false,
                  "type": "string"
                },
                "server" : {
                  "name" : "server",
                  "required" : true,
                  "type": "string"
                },
                "channels" : {
                  "name" : "channels",
                  "required" : false,
                  "type": "array"
                }
              }
            }
          }
        }
      }
    }
  }
};

IRC.prototype.init = function (session) {
  this.session = session;
  this.sessionId = session.getSessionID();
  var q = Q.defer();
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
    var client_lookup = job.actor.address + '@' + creds.server;
    //
    // check if client object already exists
    var client = session.clientManager.get(client_lookup, creds);
    if ((!client) && (create)) {
      //
      // create a client
      self._createClient(client_lookup, creds).then(q.resolve, q.reject).fail(q.reject);

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
  }, q.reject).fail(q.reject);

  return q.promise;
};

IRC.prototype._createClient = function (key, creds) {
  var session = this.session,
      sessionId = this.sessionId,
      self = this,
      q = Q.defer(),
      client;

  session.info('creating new client connection to ' + creds.server);

  var credentials = {
    nick: creds.nick,
    user: creds.actor.name,
    server: creds.server || 'irc.freenode.net',
    realname: creds.actor.name,
    port: 6667,
    secure: false
  };

  function processIncomingMessages(object) {
    session.log('INCOMING IRC OBJECT: ', object);
  }

  function onRegister(object) {
    session.info('connected to ' + creds.server);

    self.api.hookEvent(key, '*', processIncomingMessages);

    client.id = key;
    client.listeners = {};
    client.credentials = creds;
    client.end = function () {
      session.info('ending irc connection ' + this.id);
      this.irc.disconnect();
    };

    session.clientManager.add(client.id, client);

    q.resolve(client);
  }

  //
  // TODO make proper client object with .irc .listeners .credentials, etc.
  //

  // connect...
  client = self.api.createClient(key, credentials);

  self.api.unhookEvent(key, '*');
  self.api.hookEvent(key, 'registered', onRegister);

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
    console.debug('got client for '+job.actor.address, client);
    job.target.forEach(function (t) {
      // join channel
      session.debug('join: ' + job.actor.address + ' -> ' + t.address);
      client.irc.raw(['JOIN', t.address]);
      q.resolve();
    });
  }, q.reject);
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
      client.irc.raw(['PART', t.address]);
    });
    q.resolve();
  }, q.reject);
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
    session.debug('irc.say: ' + job.target[0].address+', '+ job.object.text);
    client.irc.raw(['PRIVMSG', job.target[0].address, job.object.text]);
    q.resolve();
  }, q.reject).fail(q.resolve);

  return q.promise;
};

/**
 * Function: update
 *
 * Indicate a change to a room (ie. topic update).
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
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
 *         objectType: 'topic'
 *         topic: 'New version of Socekthub released!'
 *       },
 *       rid: 1234
 *     }
 *
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
      client.irc.raw(['NICK', job.target[0].address]);

      // preserve old creds
      var oldCreds = client.credentials;

      // set new credentials
      client.credentials.nick = job.target[0].address;
      client.credentials.actor.address = job.target[0].address;
      client.credentials.actor.name = job.target[0].name || client.credentials.actor.name;

      session.setConfig('credentials', job.target[0].address, client.credentials);

      // reset index of client object in clientManager
      session.clientManager.move(client.key,
                                 oldCreds,
                                 client.credentials.nick + '@' + client.credentials.server);
    }
    q.resolve();
  }, q.reject).fail(q.reject);

  return q.promise;
};

/**
 * Function: update
 *
 * Indicate an observation to a room (ie. attendance in a room).
 *
 * Parameters:
 *
 *   job - activity streams job object
 *
 * Example:
 *
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
 *
 *   The obove object might return:
 *
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
          client.irc.raw(['WHO', t.address]);
      });
      q.resolve();
    } else {
      q.reject("unknown objectType '" + job.object.objectType + "'");
    }
  }, q.reject);

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

module.exports = function () {
  return new IRC();
};