var irc = require('irc');
var Q = require('q');

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
      join: {}
    };

    if (!handlers) {
      handlers = {};
    }

    listeners.message[sessionId] = function (from, to, message) {
      //session.log("received message from " + from + '[to: ' + to + ']: '+message);
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
      //session.log('received pivate message: ' + from );
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
      //session.log('received join status: #' + channel + ' -> ' + who);
      session.send({
        verb: 'join',
        actor: { address: who },
        target: [{ address: channel }],
        object: {}
      });
    };
    client.irc.addListener('join', listeners.join[sessionId]);

    if (handlers.error) {
      listeners.error[sessionId] = handlers.error;
    } else {
      listeners.error[sessionId] = function (error) {
        try {
          session.log("*** IRC ERROR (rl): " + error);
          session.send({
            status: false,
            verb: 'send',
            message: error
          });
        } catch (e) {
          console.log('*** IRC ERROR (rl catch): ', e);
        }
      };
    }
    client.irc.addListener('error', listeners.error[sessionId]);

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


  function getClient(job) {
    var q = Q.defer();

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
        if (!client) {
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

          session.log('attempting connect to ' + creds.server);
          client.irc.connect(3, function () {
            session.log('client connected');
            client.irc.removeListener('error', client.listeners.error[sessionId]);
            client.listeners.error[sessionId] = function (error) {
              try {
                session.log("*** IRC ERROR: " + error);
                session.send({
                  actor: { platform: 'irc' },
                  verb: job.verb,
                  status: false,
                  message: error,
                  target: []
                });
              } catch (e) {
                console.error('*** IRC ERROR (catch): ', e, error);
                throw new Error('*** IRC ERROR (catch): ' + e, error);
              }
            };
            client.irc.addListener('error', client.listeners.error[sessionId]);
            session.clientManager.add(client.id, client);
            q.resolve(client);
          });
        } else {
          session.log('returning existing client ' + client.id);
          //session.debug('client object: ', client);
          //
          // client already exists
          // make sure we have listeners for this session
          if (!client.listeners.message[sessionId]) {
            client.listeners = mergeListeners(client, registerListeners(client));
          }
          q.resolve(client);
        }
      }
    }, q.reject);

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
      q.resolve();
    }, q.reject);

    return q.promise;
  };

  pub.join = function (job) {
    var q = Q.defer();
    session.log('join() called for ' + job.actor.address);

    getClient(job).then(function (client) {
      session.log('join(): got client object');
      q.resolve();
    }, q.reject);

    return q.promise;
  };

  pub.leave = function (job) {
    var q = Q.defer();
    session.log('leave() called for ' + job.actor.address);

    getClient(job).then(function (client) {
      session.log('leave(): got client object');
      q.resolve();
    }, q.reject);

    return q.promise;
  };

  pub.observe = function (job) {
    var q = Q.defer();
    session.log('observe() called for ' + job.actor.address);

    getClient(job).then(function (client) {
      session.log('observe(): got client object');
      q.resolve();
    }, q.reject);

    return q.promise;
  };

  pub.send = function (job) {
    var q = Q.defer();
    session.log('send() called for ' + job.actor.address + ' target: ' + job.target[0].address);

    getClient(job).then(function (client) {
      session.log('send(): got client object');
      session.debug('irc.say: ' + job.target[0].address+', '+ job.object.text);
      client.irc.say(job.target[0].address, job.object.text);
      q.resolve();
    }, q.reject);

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