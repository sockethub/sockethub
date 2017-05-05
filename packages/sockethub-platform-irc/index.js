/**
 * This is a platform for sockethub implementing IRC functionality.
 *
 * copyright 2012-2015 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the LGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of this module can be found here:
 *   git://github.com/sockethub/sockethub-platform-irc.git
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

var debug = require('debug')('sockethub-platform-irc'),
    api   = new IRCFactory.Api();

var packageJSON = require('./package.json');

var receivedWho = {}; // lookup, per-channel, for latest WHO response per-channel (used to gague connectivity)

/**
 * @class IRC
 * @constructor
 *
 * @description
 * Handles all actions related to communication via. the IRC protocol.
 *
 * Uses the `irc-factory` node module as a base tool for interacting with IRC.
 *
 * {@link https://github.com/ircanywhere/irc-factory}
 *
 * @param {object} session {@link Sockethub.Session#object}
 *
 */
function IRC(session) {
  this.session   = session;
  this._channels = [];
  this._uniqueIDs = []; // unique IDs used in this session
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
 * * **NOTE**: For more information on using the credentials object from a client, see [Sockethub Client](https://github.com/sockethub/sockethub/wiki/Sockethub-Client)
 *
 * Valid AS object for setting IRC credentials:
 * @example
 *
 *  {
 *    '@type': 'set',
 *    context: 'irc',
 *    actor: {
 *      '@id': 'irc://testuser@irc.host.net',
 *      '@type': 'person',
 *      displayName: 'Mr. Test User',
 *      userName: 'testuser'
 *    },
 *    object: {
 *      '@type': 'credentials',
 *      server: 'irc.host.net',
 *      nick: 'testuser',
 *      password: 'asdasdasdasd',
 *      port: 6697,
 *      secure: true
 *    }
 *  }
 *
 *
 */
IRC.prototype.schema = {
  "version": packageJSON.version,
  "messages" : {
    "required": [ '@type' ],
    "properties": {
      "@type": {
        "enum": [ 'update', 'join', 'leave', 'send', 'observe', 'announce' ]
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
        "required": [ '@type', 'nick', 'server' ],
        "additionalProperties": false,
        "properties" : {
          "@type": {
            "name": "@type",
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

function __renameUser(id, displayName, credentials, store, client, cb) {
    // preserve old creds
    var oldCreds = credentials;
    var oldId = credentials.actor['@id'];
    var newCreds = JSON.parse(JSON.stringify(credentials));

    // set new credentials
    newCreds.object.nick       = displayName;
    newCreds.actor.displayName = displayName;
    newCreds.actor['@id']      = id;

    store.save(id, newCreds, function (err) {
        if (err) {
            return cb(err);
        }

        // reset index of client object in connection manager
        client.move(oldId, oldCreds, id, newCreds);
        return cb();
    });
}

function __genClientConnectionObject(session) {
  return {
    timeout: 30000,
    connect: function (cb) {
      var client;
      var _this = this;
      var key = this.credentials.actor['@id'];
      var is_secure = (typeof this.credentials.object.secure === 'boolean') ? this.credentials.object.secure : true;
      var module_creds = {
        nick: this.credentials.object.nick,
        user: this.credentials.object.nick,
        server: this.credentials.object.server || 'irc.freenode.net',
        realname: this.credentials.actor.displayName || this.credentials.object.nick,
        secure: is_secure,
        port: (this.credentials.object.port) ? parseInt(this.credentials.object.port, 10) : (is_secure) ? 6697 : 6667,
      };

      function onRegister() {
        _this.scope.debug('connected to ' + module_creds.server);
        api.unhookEvent(key, 'registered');
        api.unhookEvent(key, '*');
        cb(null, client);
      }
      api.unhookEvent(key, '*');

      api.hookEvent(key, '*', function (message) {
        if ((typeof message === 'object') && (typeof message.capabilities === 'object')) {
          _this.scope.send({
            '@type': 'announce',
            actor: {
              '@type': 'service',
              '@id': 'irc://' + _this.credentials.object.server
            },
            target: {
              '@type': 'person',
              '@id': 'irc://' + _this.credentials.actor['@id'] + '@' + _this.credentials.object.server
            },
            object: {
              '@type': 'content',
              content: message.capabilities
            },
            published: message.time
          });
        } else {
          debug('*: ' + JSON.stringify(message));
        }
      });

      api.hookEvent(key, 'registered', onRegister);

      this.scope.debug('attempting to connect to ' + module_creds.server + ':' + module_creds.port + ' [secure:' + is_secure + ']');

      // connect...
      client = api.createClient(key, module_creds);
    },
    listeners: {
      '*': function (object) {
        // debug('HANDLER * called [' + this.id + ']: ', object);

        if ((object.channel) && (object.raw.includes('/WHO'))) {
          this.scope.debug('received /WHO response, updating receivedWho');
          receivedWho[object.channel] = Date.now();
        }

        if (typeof object.names === 'object') {
          // user list
          this.scope.debug('received user list: ' + object.channel);
          this.scope.send({
            '@type': 'observe',
            actor: {
              '@type': 'room',
              '@id': 'irc://' + this.credentials.object.server + '/' + object.channel,
              displayName: object.channel
            },
            object: {
              '@type': 'attendance',
              members: object.names
            },
            published: object.time
          });
        } else if ((typeof object.channel === 'string') &&
                  (typeof object.who === 'object')) {
          // full who
          return;
        } else if ((typeof object.topic === 'string') &&
                  (typeof object.topicBy === 'string')) {
          // topic
          this.scope.debug('received topic change list: ' + object.channel + ':' + object.topicBy + ': ' + object.topic);
          this.scope.send({
            '@type': 'update',
            actor: {
              '@type': 'person',
              '@id': 'irc://' + object.topicBy + '@' + this.credentials.object.server,
              displayName: object.topicBy
            },
            target: {
              '@type': 'room',
              '@id': 'irc://' + this.credentials.object.server + '/' + object.channel,
              displayName: object.channel
            },
            object: {
              '@type': 'topic',
              topic: object.topic
            },
            published: object.time
          });
        } else if (typeof object.newnick === 'string') {
          // nick change
          this.scope.debug('received nick change ' + object.nickname + ' -> ' + object.newnick);
          this.scope.send({
            '@type': 'update',
            actor: {
              '@type': 'person',
              '@id': 'irc://' + object.nickname + '@' + this.credentials.object.server,
              displayName: object.nickname
            },
            target: {
              '@type': 'person',
              '@id': 'irc://' + object.newnick + '@' + this.credentials.object.server,
              displayName: object.newnick
            },
            object: {
              '@type': 'address'
            },
            published: object.time
          });
        } else if ((typeof object.channel === 'string') &&
                  (object.raw.indexOf(' JOIN ') >= 0)) {
          // join
          this.scope.debug('received join: ' + object.nickname + ' -> ' + object.channel, object);
          if (! object.nickname) {
            this.scope.debug('skipping join message with undefined nickname');
          } else {
            this.scope.send({
              '@type': 'join',
              actor: {
                '@type': 'person',
                '@id': 'irc://' + object.nickname + '@' + this.credentials.object.server,
                displayName: object.nickname
              },
              target: {
                '@type': 'room',
                '@id': 'irc://' + this.credentials.object.server + '/' + object.channel,
                displayName: object.channel
              },
              object: {},
              published: object.time
            });
          }
        } else if ((typeof object.target === 'string') &&
                  (typeof object.message === 'string')) {
          // message
          if (! object.nickname) {
            this.scope.debug('received UNKNOWN: ', object);
          } else {
            var msg_prefix = ':' + object.nickname + '!' + object.username + '@' + object.hostname;
            var type = 'message';

            if (object.raw.indexOf(msg_prefix + ' NOTICE ') === 0) {
              type = 'notice';
            } else if (object.raw.indexOf('ACTION ') === ((msg_prefix + ' PRIVMSG ' + object.target).length + 3)) {
              type = 'me';
            }

            this.scope.debug('received ' + type + ' : ' + object.nickname + ' -> ' + object.target);
            this.scope.send({
              '@type': 'send',
              actor: {
                '@type': 'person',
                '@id': 'irc://' + object.nickname + '@' + this.credentials.object.server,
                displayName: object.nickname
              },
              target: {
                displayName: object.target
              },
              object: {
                '@type': type,
                content: object.message
              },
              published: object.time
            });
          }
        } else if (typeof object.motd === 'object') {
          // send motd
          this.scope.debug('sending motd');
          this.scope.send({
            '@type': 'update',
            actor: {
              '@type': 'service',
              '@id': 'irc://' + this.credentials.object.server,
              displayName: this.credentials.object.server
            },
            object: {
              '@type': 'topic',
              content: object.motd
            },
            published: object.time
          });
        } else if ((typeof object.nickname === 'string') &&
                  (typeof object.mode === 'string')) {
          // verify username
          debug('verifying username ' + object.nickname + ' against ' + this.credentials.actor.displayName);
          if (object.nickname !== this.credentials.actor.displayName) {
              this.scope.debug('server name conflict, renaming to ' + object.nickname);
              __renameUser('irc://' + object.nickname + '@' + this.credentials.object.server,
                          object.nickname, this.credentials, this.scope.store, session.connectionManager, function (err) {
                  this.scope.send({
                      '@type': 'update',
                      actor: {
                          '@type': 'person',
                          '@id': 'irc://' + this.credentials.actor.displayName + '@' + this.credentials.object.server,
                          displayName: this.credentials.actor.displayName
                      },
                      target: {
                          '@type': 'person',
                          '@id': 'irc://' + object.nickname + '@' + this.credentials.object.server,
                          displayName: object.nickname
                      },
                      object: {
                          '@type': 'address'
                      },
                      published: object.time
                  });
              }.bind(this));
          }
          return;
        } else if ((typeof object.nickname === 'string') &&
                  (typeof object.capabilities === 'object') &&
                  (typeof object.time === 'string') &&
                  (typeof object.raw === 'object')) {
          // registered
          debug('registered! ', object);
        } else if ((object.reconnecting === true) &&
                  (typeof object.attempts === 'number')) {
          // disconected, reconnecting
          if ((typeof this.connection.irc === 'object') &&
             (typeof this.connection.irc.reconnect === 'function')) {
            debug('disconnected, reconnecting. for ' + this.id);
            this.connection.irc.reconnect();
          } else {
            debug('skipping reconnect as we are already disconnected. for ' + this.id);
          }
        } else if ((typeof object.nickname === 'string') &&
                  (typeof object.target === 'undefined') &&
                  (typeof object.capabilities !== 'object')) {
          // QUIT
          debug('received quit', object);
          var quitter = object.kicked || object.nickname;
          var msg = (typeof object.kicked === 'string') ? 'user has been kicked' : 'user has quit';
          this.scope.debug((typeof object.kicked === 'string') ? 'kick' : 'quit' + '', object);

          if (! this.scope.disconnected) {
            this.scope.send({
              '@type': 'leave',
              actor: {
                '@type': 'person',
                '@id': 'irc://' + quitter + '@' + this.credentials.object.server,
                displayName: quitter
              },
              target: {
                '@type': 'room',
                '@id': 'irc://' + this.credentials.object.server + '/' + object.channel,
                displayName: object.channel
              },
              object: {
                '@type': 'message',
                content: msg
              },
              published: object.time
            });
          }

          // if (quitter === this.credentials.actor.displayName) {
          //   this.scope.debug('disconnecting self');
          //   if ((this.connection) && (this.connection.irc.disconnect)) {
          //     this.connection.irc.disconnect();
          //   }
          //   this.scope.disconnected = true;
          // }
        } else if ((typeof object.channel === 'string') &&
                  (object.raw.indexOf(' PART ') >= 0)) {
          // leave
          this.scope.debug('received leave: ' + object.nickname + ' -> ' + object.target, object);
          this.scope.send({
            '@type': 'leave',
            actor: {
              '@type': 'person',
              '@id': 'irc://' + object.nickname + '@' + this.credentials.object.server,
              displayName: object.nickname
            },
            target: {
              '@type': 'room',
              '@id': 'irc://' + this.credentials.object.server + '/' + object.target,
              displayName: object.target
            },
            object: {
              '@type': 'message',
              content: 'user has left the channel'
            },
            published: object.time
          });
      } else if ((object.command === 'ERR_CHANOPRIVSNEEDED') &&
                 ((typeof object.params === 'object') && (typeof object.params.length === 'number'))) {
          var [ username, channel, message ] = object.params;
          this.scope.send({
            '@type': 'send',
            actor: {
              '@type': 'room',
              '@id': 'irc://' + this.credentials.object.server + '/' + channel``
            },
            target: {
              '@type': 'person',
              '@id': 'irc://' + username + '/' + this.credentials.object.server
            },
            object: {
              '@type': 'message',
              content: message
            }
          });
        } else {
          debug('Unprocessed message [' + this.id + ']: ', object);
        }
      }
    },
    addListener: function (name, func) {
      this.scope.debug('addListener called! ' + this.id + ' ' + name);
      api.hookEvent(this.id, name, func);
    },
    removeListener: function (name) {
      this.scope.debug('removeListener called!');
      api.unhookEvent(this.id, name);
    },
    isConnected: function () {
      if (! this.connection.irc) {
        return false;
      }
      debug('isConnected() called, returning: ' + this.connection.irc.isConnected());
      return this.connection.irc.isConnected();
    },
    disconnect: function (cb) {
      this.scope.debug('disconnect for ' + this.id);
      this.scope.quit = true;
      this.connection.irc.disconnect();
      api.unhookEvent(this.id, '*'); // this has to happen before the destroyClient or the client stays alive.
      api.destroyClient(this.id);
      cb();
    }
  };
}

/**
 * Function: join
 *
 * Join a room or private conversation.
 *
 * @example
 *
 * {
 *   context: 'irc',
 *   '@type': 'join',
 *   actor: {
 *     '@id': 'irc://slvrbckt@irc.freenode.net',
 *     '@type': 'person',
 *     displayName: 'slvrbckt'
 *   },
 *   target: {
 *     '@id': 'irc://irc.freenode.net/sockethub',
 *     '@type': 'room',
 *     displayName: '#sockethub'
 *   },
 *   object: {}
 * }
 *
 */
IRC.prototype.join = function (job, done) {
  var self = this;
  self.session.debug('join() called for ' + job.actor['@id']);

  self.session.connectionManager.get(job.actor['@id'], __genClientConnectionObject(self.session), function (err, client) {
    if (err) { return done(err); }

    self.__addUnique(job.actor['@id']);
    self.session.debug('got client for ' + job.actor['@id']);
    // join channel
    self.session.debug('join: ' + job.actor.displayName + ' -> ' + job.target.displayName);
    client.connection.irc.raw(['JOIN', job.target.displayName]);
    self.__joined(job.target.displayName);
    setTimeout(function () {
      self.session.debug('sending /WHO');
      client.connection.irc.raw(['WHO', job.target.displayName]);
      receivedWho[job.target.displayName] = receivedWho[job.target.displayName] || 0;
      setTimeout(function () {
        if (receivedWho[job.target.displayName] > (Date.now() - 7000)) {
          self.session.debug('response from WHO command not received, possible disconnect. TODO something about it.');
        } else {
          self.session.debug('response time acceptable, were live. [' + typeof receivedWho[job.target.displayName] + '] ' + receivedWho[job.target.displayName] + ' > [' + typeof (Date.now() - 7000) + '] ' + (Date.now() - 7000), receivedWho);
        }
      }, 5000);
    }, 5000);
    done();
  });
};

/**
 * @function leave
 *
 * @description
 * Leave a room or private conversation.
 *
 * @example
 * {
 *   context: 'irc',
 *   '@type': 'leave',
 *   actor: {
 *     '@id': 'irc://slvrbckt@irc.freenode.net',
 *     '@type': 'person',
 *     displayName: 'slvrbckt'
 *   },
 *   target: {
 *     '@id': 'irc://irc.freenode.net/remotestorage',
 *     '@type': 'room',
 *     displayName: '#remotestorage'
 *   },
 *   object: {}
 * }
 *
 */
IRC.prototype.leave = function (job, done) {
  var self = this;

  self.session.debug('leave() called');

  self.session.connectionManager.get(job.actor['@id'], __genClientConnectionObject(self.session), function (err, client) {
    if (err) { return done(err); }
    // leave channel
    self.__addUnique(job.actor['@id']);
    self.session.debug('leave: ' + job.actor.displayName + ' -< ' + job.target.displayName);
    client.connection.irc.raw(['PART', job.target.displayName]);
    self.__left(job.target.displayName);
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
 *  {
 *    context: 'irc',
 *    '@type': 'send',
 *    actor: {
 *      '@id': 'irc://slvrbckt@irc.freenode.net',
 *      '@type': 'person',
 *      displayName: 'Nick Jennings',
 *      userName: 'slvrbckt'
 *    },
 *    target: {
 *      '@id': 'irc://irc.freenode.net/remotestorage',
 *      '@type': 'room',
 *      displayName: '#remotestorage'
 *    },
 *    object: {
 *      '@type': 'message',
 *      content: 'Hello from Sockethub!'
 *    }
 *  }
 *
 */
IRC.prototype.send = function (job, done) {
  var self = this;

  self.session.debug('send() called for ' + job.actor['@id'] + ' target: ' + job.target['@id']);

  self.session.connectionManager.get(job.actor['@id'], __genClientConnectionObject(self.session), function (err, client) {
    if (err) { return done(err); }
    err = undefined;

    self.__addUnique(job.actor['@id']);
    self.session.debug('send(): got client object');

    if (typeof job.object.content !== 'string') {
      return done('cannot send message with no object.content');
    }

    var msg = job.object.content.replace(/^\s+|\s+$/g, "");

    if (msg.indexOf('/') === 0) {
      // message intented as command
      msg += ' ';
      var cmd = msg.substr(0, msg.indexOf(' ')).substr(1).toUpperCase(); // get command
      msg = msg.substr(msg.indexOf(' ') + 1).replace(/\s\s*$/, ''); // remove command from message
      if (cmd === 'ME') {
        // handle /me messages uniquely
        job.object['@type'] = 'me';
        job.object.content = msg;
      } else if (cmd === 'NOTICE') {
        // attempt to send as raw command
        job.object['@type'] = 'notice';
        job.object.content = msg;
      }
    } else {
      job.object.content = msg;
    }

    if (job.object['@type'] === 'me') {
      // message intented as command
      self.session.debug('sending ME message to room ' + job.target.displayName + ': ' + job.actor.displayName + ' ' + job.object.content);
      client.connection.irc.me(job.target.displayName, job.object.content);
    } else if (job.object['@type'] === 'notice') {
      // attempt to send as raw command
      self.session.debug('sending RAW command: NOTICE to ' + job.target.displayName + ', ' + job.object.content);
      client.connection.irc.raw(['NOTICE', job.target.displayName, job.object.content]);
    } else if (self.__isJoined(job.target.displayName)) {
      self.session.debug('irc.say: ' + job.target.displayName + ', [' + job.object.content + ']');
      client.connection.irc.privmsg(job.target.displayName, job.object.content, true); //forcePushback
    } else {
      err = "cannot send message to a channel of which you've not first `join`ed.";
    }

    self.session.debug('sending ping to #sockethub');
    client.connection.irc.raw(['PING', '#sockethub']);
    done(err);
  });
};

/**
 * Function: update
 *
 * Indicate a change (ie. room topic update, or nickname change).
 *
 * @example change topic
 *
 * {
 *   context: 'irc',
 *   '@type': 'update',
 *   actor: {
 *     '@id': 'irc://slvrbckt@irc.freenode.net',
 *     '@type': 'person',
 *     displayName: 'Nick Jennings',
 *     userName: 'slvrbckt'
 *   },
 *   target: {
 *     '@id': 'irc://irc.freenode.net/sockethub',
 *     '@type': 'room',
 *     displayName: '#sockethub'
 *   },
 *   object: {
 *     '@type': 'topic',
 *     topic: 'New version of Socekthub released!'
 *   }
 * }
 *
 * @example change nickname
 * // TODO review, also when we rename a user, their person
 * //      object needs to change (and their credentials)
 *
 *  {
 *    context: 'irc'
 *    '@type': 'udpate',
 *    actor: {
 *      '@id': 'irc://slvrbckt@irc.freenode.net',
 *      '@type': 'person',
 *      displayName: 'Nick Jennings',
 *      userName: 'slvrbckt'
 *    },
 *    object: {
 *      '@type': "person",
 *      displayName: 'CoolDude'
 *    },
 *    target: {
 *      '@id': 'irc://irc.freenode.net',
 *      '@type': 'service' // FIXME - rewrite
 *    }
 *  }
 */
IRC.prototype.update = function (job, done) {
  var self = this;

  self.session.debug('update() called for ' + job.actor.displayName);

  self.session.connectionManager.get(job.actor['@id'], __genClientConnectionObject(self.session), function (err, client) {
    if (err) { return done(err); }

    self.__addUnique(job.actor['@id']);
    self.session.debug('update(): got client object');

    if (job.target['@type'] === 'person') {
      self.session.debug('changing nick from ' + job.actor.displayName + ' to ' + job.target.displayName);
      // send nick change command
      client.connection.irc.raw(['NICK', job.target.displayName]);
      __renameUser(job.target['@id'], job.target.displayName, client.credentials, self.session.store, self.session.connectionManager, done);
    } else if (job.object['@type'] === 'topic') {
      // update topic
      self.session.debug('changing topic in channel ' + job.target.displayName);
      client.connection.irc.raw(['topic', job.target.displayName, job.object.topic]);
      return done();
    } else {
      done('unknown update action');
    }
  });

};

/**
 * Function: observe
 *
 * Indicate an intent to observe something (ie. get a list of users in a room).
 *
 * @example
 *
 *  {
 *    context: 'irc',
 *    '@type': 'observe',
 *    actor: {
 *      '@id': 'irc://slvrbckt@irc.freenode.net',
 *      '@type': 'person',
 *      displayName: 'Nick Jennings',
 *      userName: 'slvrbckt'
 *    },
 *    target: {
 *      '@id': 'irc://irc.freenode.net/sockethub',
 *      '@type': 'room',
 *      displayName: '#sockethub'
 *    },
 *    object: {
 *      '@type': 'attendance'
 *    }
 *  }
 *
 *
 *  // The obove object might return:
 *  {
 *    context: 'irc',
 *    '@type': 'observe',
 *    actor: {
 *      '@id': 'irc://irc.freenode.net/sockethub',
 *      '@type': 'room',
 *      displayName: '#sockethub'
 *    },
 *    target: {},
 *    object: {
 *      '@type': 'attendance'
 *      members: [
 *        'RyanGosling',
 *        'PeeWeeHerman',
 *        'Commando',
 *        'Smoochie',
 *        'neo'
 *      ]
 *    }
 *  }
 *
 */
IRC.prototype.observe = function (job, done) {
  var self = this;
  self.session.debug('observe() called for ' + job.actor['@id']);
  self.session.connectionManager.get(job.actor['@id'], __genClientConnectionObject(self.session), function (err, client) {
    if (err) { return done(err); }

    self.__addUnique(job.actor['@id']);
    self.session.debug('observe(): got client object');
    if (job.object['@type'] === 'attendance') {
      self.session.debug('objserve() - sending NAMES for ' + job.target.displayName);
      client.connection.irc.raw(['NAMES', job.target.displayName]);
      done();
    } else {
      done("unknown '@type' '" + job.object['@type'] + "'");
    }
  });
};


IRC.prototype.cleanup = function (done) {
  // this.session.debug('cleanup() called, removing sessions for ', this._uniqueIDs);

  this._uniqueIDs.forEach(function (id, i) {
    this.session.connectionManager.get(id, __genClientConnectionObject(this.session), function (err, client) {
      if (err) { return done(err); }
      this.session.debug('cleanup(): disconnection ' + id);
      if (client.connection.irc === 'object') {
        if (client.connection.irc.disconnect === 'function') {
          client.connection.irc.disconnect();
        }
      }
    }.bind(this));
    this._uniqueIDs.splice(this._uniqueIDs.indexOf(id), 1); // remove this id from list
  }.bind(this));

  this.session.connectionManager.removeAll();
  this._uniqueIDs = [];
  this._channels = [];
  done();
};

IRC.prototype.__isJoined = function (channel) {
  if (channel.indexOf('#') === 0) {
    // valid channel name
    if (this._channels.indexOf(channel) >= 0) {
      return true;
    } else {
      return false;
    }
  } else {
    // usernames are always OK to send to
    return true;
  }
};

IRC.prototype.__joined = function (channel) {
  // keep track of channels joined
  if (this._channels.indexOf(channel) < 0) {
    this._channels.push(channel);
  }
};

IRC.prototype.__left = function (channel) {
  // keep track of channels left
  var index = this._channels.indexOf(channel);

  if (index >= 0) {
    this._channels.splice(index, 1);
  }
};

IRC.prototype.__addUnique = function (field) {
  if (this._uniqueIDs.indexOf(field) >= 0) {
    return false;
  } else {
    this._uniqueIDs.push(field);
    return true;
  }
};

module.exports = IRC;
