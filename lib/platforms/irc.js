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
var irc = require('irc');
var Q = require('q');

function processError(error) {
  var info = {
    nick: undefined,
    channel: undefined,
    verb: undefined,
    message: undefined
  };

  if (error.rawCommand === '404') {
    info = {
      nick: error.args[0] || undefined,
      channel: error.args[1] || undefined,
      message: error.args[2] || undefined,
      verb: 'send'
    };
  }
  return info;
}

// merge new set of listeners with possibly already existing listeners
// attached to a client + session
function mergeListeners(client, listeners) {
  if (typeof client.listeners !== 'object') {
    client.listeners = listeners;
  } else {

    for (var type in listeners) {
      for (var listener in listeners[type]) {
        client.listeners[type][listener] = listeners[type][listener];
      }
    }
  }

  return client.listeners;
}

function IRC() {}
IRC.prototype = {
  session: undefined,
  sessionId: undefined,
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

IRC.prototype._registerListeners = function (client, handlers) {
  var self = this;
  self.session.log('registering listeners for sessionId: ' + self.sessionId);
  var listeners = {
    message: {},
    pm: {},
    error: {},
    join: {},
    part: {},
    names: {},
    topic: {},
    nick: {},
    registered: {},
    raw: {}
  };

  if (!handlers) {
    handlers = {};
  }

  listeners.message[self.sessionId] = function (from, to, message) {
    self.session.log("received message from " + from + '[to: ' + to + ']: '+message);
    self.session.send({
      verb: 'send',
      actor: { address: from },
      target: [{ address: to || '' }],
      object: {
        text: message
      }
    });
  };
  client.irc.addListener('message', listeners.message[self.sessionId]);

  listeners.pm[self.sessionId] = function (from, message) {
    self.session.log('received pivate message: ' + from );
    if (from !== client.actor) {
      self.session.send({
        verb: 'send',
        actor: { address: from },
        target: [{ address: client.actor }],
        object: {
          text: message
        }
      });
    }
  };
  client.irc.addListener('pm', listeners.pm[self.sessionId]);

  listeners.join[self.sessionId] = function (channel, who) {
    self.session.log('received join status: ' + channel + ' -> ' + who);
    self.session.send({
      verb: 'join',
      actor: { address: who },
      target: [{ address: channel }],
      object: {}
    });
  };
  client.irc.addListener('join', listeners.join[self.sessionId]);

  listeners.part[self.sessionId] = function (channel, who, reason, message) {
    self.session.log('received leave status: ' + channel + ' -> ' + who);
    self.session.send({
      verb: 'leave',
      actor: { address: who },
      target: [{ address: channel }],
      object: {
        reason: reason
      }
    });
  };
  client.irc.addListener('part', listeners.part[self.sessionId]);

  listeners.names[self.sessionId] = function (channel, nicks) {
    //self.session.log('received user list: #' + channel + ': ', nicks);
    var cleanNicks = [];
    for (var key in nicks) {
      cleanNicks.push(key);
    }
    self.session.send({
      verb: 'observe',
      actor: { address: channel },
      target: [{ address: channel }],
      object: {
        'objectType': 'attendance',
        members: cleanNicks
      }
    });
  };
  client.irc.addListener('names', listeners.names[self.sessionId]);

  listeners.topic[self.sessionId] = function (channel, topic, nick, message) {
    //self.session.log('received topic change list: #' + channel + ':'+nick+': '+ topic);
    self.session.send({
      verb: 'update',
      actor: { address: nick },
      target: [{ address: channel }],
      object: {
        'objectType': 'topic',
        topic: topic
      }
    });
  };
  client.irc.addListener('topic', listeners.topic[self.sessionId]);

  listeners.nick[self.sessionId] = function (oldnick, newnick, channels, message) {
    self.session.log('received nick change ' + oldnick + ' -> ' + newnick);
    self.session.send({
      verb: 'update',
      actor: { address: oldnick },
      target: [{ address: newnick }],
      object: {
        'objectType': 'address'
      }
    });
  };
  client.irc.addListener('nick', listeners.nick[self.sessionId]);

  if (handlers.error) {
    listeners.error[self.sessionId] = handlers.error;
  } else {
    listeners.error[self.sessionId] = function (error) {
      try {
        self.session.log("*** IRC ERROR (rl): " + error);
        var info = processError(error);
        self.session.send({
          status: false,
          verb: info.verb,
          message: info.message,
          object: info
        });
      } catch (e) {
        console.log('*** IRC ERROR (rl catch): ', e);
      }
    };
  }
  client.irc.addListener('error', listeners.error[self.sessionId]);

  listeners.raw[self.sessionId] = function (message) {
    //console.log("IRC RAW MESSAGE: ", message);
  };
  client.irc.addListener('raw', listeners.raw[self.sessionId]);

  self.session.log('finished registering listeners for sessionId: ' + self.sessionId);
  return listeners;
};


IRC.prototype.getClient = function (job, create) {
  var q = Q.defer();
  var session = this.session,
      sessionId = this.sessionId;

  create = (typeof create === 'boolean') ? create : true;

  session.getConfig('credentials').then(function (credentials) {
    //
    // get credentials
    if (typeof credentials[job.actor.address] === 'undefined') {
      q.reject('unable to get credentials for ' + job.actor.address);
    } else {
      session.log('got config for ' + job.actor.address);
      var creds = credentials[job.actor.address]; // this actors creds
      var client_lookup = job.actor.address + '@' + creds.server;
      //
      // check if client object already exists
      var client = session.clientManager.get(client_lookup, creds);
      if ((!client) && (create)) {
        session.log('creating new client connection to ' + creds.server);
        client = {
          id: client_lookup,
          actor: job.actor.address,
          end: function () {
            session.log('ending irc connection');
            this.irc.disconnect();
          },
          credentials: creds
        };

        session.debug('connecting to: ' + creds.server +  ' with nick: ' +
                      creds.nick + ' and channels: ', creds.channels);
        client.irc = new irc.Client(creds.server, creds.nick, {
                                        channels: creds.channels,
                                        userName: job.actor.address,
                                        realName: job.actor.name,
                                        autoConnect: false
                                      });
        var handlers = {};
        handlers.error = function (error) {
          console.error('got error: ', error);
          q.reject(error);
        };

        //
        // adds listener function references to client.listeners
        client.listeners = mergeListeners(client, registerListeners(client, handlers));

        client.irc.removeListener('registered', client.listeners.error[self.sessionId]);
        client.listeners.registered[self.sessionId] = function () {
          session.log('client connected');
          session.clientManager.add(client.id, client);
          q.resolve(client);
        };
        client.irc.addListener('registered', client.listeners.registered[self.sessionId]);

        session.log('attempting connect to ' + creds.server);
        client.irc.connect(3, function () {
          client.irc.removeListener('error', client.listeners.error[self.sessionId]);
          client.listeners.error[self.sessionId] = function (error) {
            session.log("*** IRC ERROR: ", error);
            var info = processError(error);
            try {
              session.send({
                actor: { platform: 'irc' },
                verb: info.verb || job.verb,
                status: false,
                object: {
                  error: error
                },
                message: JSON.stringify(error.args),
                target: []
              });
            } catch (e) {
              console.error('*** IRC ERROR (catch): ', e, error);
              throw new Error('*** IRC ERROR (catch): ' + e, error);
            }
          };
          client.irc.addListener('error', client.listeners.error[self.sessionId]);
        });
      } else if (client) {
        session.log('returning existing client ' + client.id);
        //session.debug('client object: ', client);
        //
        // client already exists
        // make sure we have listeners for this session
        if (!client.listeners.message[self.sessionId]) {
          client.listeners = mergeListeners(client, registerListeners(client));
        }
        q.resolve(client);
      } else {
        // no existing client and do not create a new one
        q.reject();
      }
    }
  }, q.reject).fail(q.reject);

  return q.promise;
};


IRC.prototype.init = function (sess) {
  this.session = sess;
  this.sessionId = sess.getSessionID();
  var q = Q.defer();
  q.resolve();
  return q.promise;
};

IRC.prototype.update = function (job) {
  var q = Q.defer();
  var session = this.session,
    sessionId = this.sessionId;

  session.log('update() called for ' + job.actor.address);

  this.getClient(job).then(function (client) {
    session.log('update(): got client object');

    if ((typeof job.object.objectType === 'string') &&
        (job.object.objectType === 'address')) {
      session.log('changing nick from ' + job.actor.address + ' to ' + job.target[0].address);
      // set nick change
      client.irc.send('NICK', job.target[0].address);
      // preserve old creds
      var oldCreds = client.credentials;
      // set new credentials
      client.credentials.nick = job.target[0].address;
      client.credentials.actor.address = job.target[0].address;
      client.credentials.actor.name = job.target[0].name || client.credentials.actor.name;
      var newCreds = {};
      newCreds[job.target[0].address] = client.credentials;
      session.setConfig('credentials', newCreds);
      // reset index of client object in clientManager
      session.clientManager.move(client.key,
                                 oldCreds,
                                 client.credentials.nick + '@' + client.credentials.server);
    }
    q.resolve();
  }, q.reject).fail(q.reject);

  return q.promise;
};

IRC.prototype.join = function (job) {
  var q = Q.defer();
  var session = this.session,
      sessionId = this.sessionId;

  session.log('join() called for ' + job.actor.address);

  this.getClient(job).then(function (client) {
    var sentTargets = false;
    for (var i = 0, num = job.target.length; i < num; i = i + 1) {
      if (job.target[i].address) {
        client.irc.join(job.target, function () {
          sentTargets = true;
          q.resolve();
        });
      }
    }
    if (!sentTargets) {
      q.reject('no targets found');
    }
  }, q.reject);

  return q.promise;
};

IRC.prototype.leave = function (job) {
  var q = Q.defer();
  session.log('leave() called for ' + job.actor.address);

  getClient(job).then(function (client) {
    var sentTargets = false;
    for (var i = 0, num = job.target.length; i < num; i = i + 1) {
      if (job.target[i].address) {
        var msg = job.object.text || '';
        client.irc.part(job.target, msg, function () {
        sentTargets = true;
          q.resolve();
        });
      }
    }
    if (!sentTargets) {
      q.reject('no targets found');
    }
  }, q.reject);

  return q.promise;
};

IRC.prototype.observe = function (job) {
  var q = Q.defer();
  var session = this.session,
      sessionId = this.sessionId;

  session.log('observe() called for ' + job.actor.address);

  getClient(job).then(function (client) {
    session.log('observe(): got client object');
    var sentTargets = false;
    for (var i = 0, num = job.target.length; i < num; i = i + 1) {
      if (job.target[i].address) {
        // var msg = job.object.text || '';
        // client.irc.part(job.target, msg, function () {
        //   q.resolve();
        // });
      }
      q.resolve();
    }
    if (!sentTargets) {
      q.reject('no targets found');
    }
  }, q.reject);

  return q.promise;
};

IRC.prototype.send = function (job) {
  var q = Q.defer();
  var session = this.session,
      sessionId = this.sessionId;

  session.log('send() called for ' + job.actor.address + ' target: ' + job.target[0].address);

  getClient(job, false).then(function (client) {
    session.log('send(): got client object');
    session.debug('irc.say: ' + job.target[0].address+', '+ job.object.text);
    client.irc.say(job.target[0].address, job.object.text);
    q.resolve();
  }, q.reject).fail(q.resolve);

  return q.promise;
};

IRC.prototype.fetch = function (job) {
  var q = Q.defer();
  q.resolve();
  return q.promise;
};

IRC.prototype.cleanup = function (job) {
  var q = Q.defer();
  q.resolve();
  return q.promise;
};


module.exports = function () {
  return new IRC();
};