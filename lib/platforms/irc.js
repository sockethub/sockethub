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

var IRC = function () {
  var session = '',
      sessionId = '',
      pub = {};

  function registerListeners(client, handlers) {
    session.log('registering listeners for sessionId: ' + sessionId);
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

    listeners.message[sessionId] = function (from, to, message) {
      session.log("received message from " + from + '[to: ' + to + ']: '+message);
      session.send({
        verb: 'send',
        actor: { address: from },
        target: [{ address: to || '' }],
        object: {
          text: message
        }
      });
    };
    client.irc.addListener('message', listeners.message[sessionId]);

    listeners.pm[sessionId] = function (from, message) {
      session.log('received pivate message: ' + from );
      if (from !== client.actor) {
        session.send({
          verb: 'send',
          actor: { address: from },
          target: [{ address: client.actor }],
          object: {
            text: message
          }
        });
      }
    };
    client.irc.addListener('pm', listeners.pm[sessionId]);

    listeners.join[sessionId] = function (channel, who) {
      session.log('received join status: ' + channel + ' -> ' + who);
      session.send({
        verb: 'join',
        actor: { address: who },
        target: [{ address: channel }],
        object: {}
      });
    };
    client.irc.addListener('join', listeners.join[sessionId]);

    listeners.part[sessionId] = function (channel, who, reason, message) {
      session.log('received leave status: ' + channel + ' -> ' + who);
      session.send({
        verb: 'leave',
        actor: { address: who },
        target: [{ address: channel }],
        object: {
          reason: reason
        }
      });
    };
    client.irc.addListener('part', listeners.part[sessionId]);

    listeners.names[sessionId] = function (channel, nicks) {
      //session.log('received user list: #' + channel + ': ', nicks);
      var cleanNicks = [];
      for (var key in nicks) {
        cleanNicks.push(key);
      }
      session.send({
        verb: 'observe',
        actor: { address: channel },
        target: [{ address: channel }],
        object: {
          'objectType': 'attendance',
          members: cleanNicks
        }
      });
    };
    client.irc.addListener('names', listeners.names[sessionId]);

    listeners.topic[sessionId] = function (channel, topic, nick, message) {
      //session.log('received topic change list: #' + channel + ':'+nick+': '+ topic);
      session.send({
        verb: 'update',
        actor: { address: nick },
        target: [{ address: channel }],
        object: {
          'objectType': 'topic',
          topic: topic
        }
      });
    };
    client.irc.addListener('topic', listeners.topic[sessionId]);

    listeners.nick[sessionId] = function (oldnick, newnick, channels, message) {
      session.log('received nick change ' + oldnick + ' -> ' + newnick);
      session.send({
        verb: 'update',
        actor: { address: oldnick },
        target: [{ address: newnick }],
        object: {
          'objectType': 'address'
        }
      });
    };
    client.irc.addListener('nick', listeners.nick[sessionId]);

    if (handlers.error) {
      listeners.error[sessionId] = handlers.error;
    } else {
      listeners.error[sessionId] = function (error) {
        try {
          session.log("*** IRC ERROR (rl): " + error);
          var info = processError(error);
          session.send({
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
    client.irc.addListener('error', listeners.error[sessionId]);

    listeners.raw[sessionId] = function (message) {
      //console.log("IRC RAW MESSAGE: ", message);
    };
    client.irc.addListener('raw', listeners.raw[sessionId]);

    session.log('finished registering listeners for sessionId: ' + sessionId);
    return listeners;
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


  function getClient(job, create) {
    var q = Q.defer();

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

          client.irc.removeListener('registered', client.listeners.error[sessionId]);
          client.listeners.registered[sessionId] = function () {
            session.log('client connected');
            session.clientManager.add(client.id, client);
            q.resolve(client);
          };
          client.irc.addListener('registered', client.listeners.registered[sessionId]);

          session.log('attempting connect to ' + creds.server);
          client.irc.connect(3, function () {
            client.irc.removeListener('error', client.listeners.error[sessionId]);
            client.listeners.error[sessionId] = function (error) {
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
            client.irc.addListener('error', client.listeners.error[sessionId]);
          });
        } else if (client) {
          session.log('returning existing client ' + client.id);
          //session.debug('client object: ', client);
          //
          // client already exists
          // make sure we have listeners for this session
          if (!client.listeners.message[sessionId]) {
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
  }



  pub.schema = {
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
  };

  pub.init = function (sess) {
    session = sess;
    sessionId = session.getSessionID();
    var q = Q.defer();
    q.resolve();
    return q.promise;
  };

  pub.update = function (job) {
    var q = Q.defer();
    session.log('update() called for ' + job.actor.address);

    getClient(job).then(function (client) {
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

  pub.join = function (job) {
    var q = Q.defer();
    session.log('join() called for ' + job.actor.address);

    getClient(job).then(function (client) {
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

  pub.leave = function (job) {
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

  pub.observe = function (job) {
    var q = Q.defer();
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

  pub.send = function (job) {
    var q = Q.defer();
    session.log('send() called for ' + job.actor.address + ' target: ' + job.target[0].address);

    getClient(job, false).then(function (client) {
      session.log('send(): got client object');
      session.debug('irc.say: ' + job.target[0].address+', '+ job.object.text);
      client.irc.say(job.target[0].address, job.object.text);
      q.resolve();
    }, q.reject).fail(q.resolve);

    return q.promise;
  };

  pub.fetch = function (job) {
    var q = Q.defer();
    q.resolve();
    return q.promise;
  };

  pub.cleanup = function (job) {
    var q = Q.defer();
    q.resolve();
    return q.promise;
  };

  return pub;
};

module.exports = function () {
  return new IRC();
};