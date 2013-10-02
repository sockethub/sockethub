var irc = require('irc');

var IRC = function () {
  var session = '',
      sessionId = '';



  function registerListeners(client, handlers) {
    session.log('registering listeners for sessionId: ' + sessionId);
    var listeners = {
      message: {},
      pm: {},
      error: {}
    };

    if (!handlers) {
      handlers = {};
    }

    listeners['message'][sessionId] = function (from, to, message) {
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
    client.irc.addListener('message', listeners['message'][sessionId]);

    listeners['pm'][sessionId] = function (from, message) {
      if (from !== client.actor) {
        session.log('received pivate message: ' + from );
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
    client.irc.addListener('pm', listeners['pm'][sessionId]);


    if (handlers.error) {
      listeners['error'][sessionId] = handlers.error;
    } else {
      listeners['error'][sessionId] = function (error) {
        try {
          session.log("*** IRC ERROR (rl): " + error);
          session.send({
            verb: 'error',
            message: error
          });
        } catch (e) {
          console.log('*** IRC ERROR (rl catch): ', e);
        }
      };
    }
    client.irc.addListener('error', listeners['error'][sessionId]);

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
  }


  function getClient(actor) {
    var promise = session.promising();

    session.getConfig('credentials').then(function (credentials) {
      //
      // get credentials
      if (typeof credentials[actor] === 'undefined') {
        promise.reject('unable to get credentials for ' + actor);
      } else {
        session.log('got config for ' + actor);
        var creds = credentials[actor]; // this actors creds
        var client_lookup = actor + '@' + creds.server;

        //
        // check if client object already exists
        var client = session.clientManager.get(client_lookup, creds);
        if (!client) {
          session.log('creating new client connection to ' + creds.server);
          client = {
            id: client_lookup,
            actor: actor,
            end: function () {
              session.log('ending irc connection');
              this.irc.disconnect();
            },
            credentials: creds
          };

          client.irc = new irc.Client(creds.server, creds.nick,
                                      {channels: creds.channels});
          var handlers = {};
          handlers['error'] = function (err) {
            console.error('got error: ', err);
            promise.reject(err);
          };

          mergeListeners(registerListeners(client, handlers));
          session.clientManager.add(client.actor, client);
          promise.fulfill(client);
        } else {
          session.log('returning existing client ' + creds.server);

          //
          // client already exists
          // make sure we have listeners for this session
          if (!client.listeners['online'][sessionId]) {
            mergeListeners(client, registerListeners(client));
          }
          promise.fulfill(client);
        }
      }
    }, promise.reject);

    return promise;
  }



  var schema = {
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

  var init = function (sess) {
    session = sess;
    sessionId = session.getSessionID();
    var promise = session.promising();
    promise.fulfill();
    return promise;
  };

  var update = function (job) {
    var promise = session.promising();
    session.log('update() called for ' + job.actor.address);

    getClient(job.actor.address).then(function (client) {
      session.log('update(): got client object');
      promise.fulfill();
    }, promise.reject);

    return promise;
  };

  var join = function (job) {
    var promise = session.promising();
    session.log('join() called for ' + job.actor.address);

    getClient(job.actor.address).then(function (client) {
      session.log('join(): got client object');
      promise.fulfill();
    }, promise.reject);

    return promise;
  };

  var send = function (job) {
    var promise = session.promising();
    session.log('send() called for ' + job.actor.address + ' target: ' + job.target[0].address);

    getClient(job.actor.address).then(function (client) {
      session.log('send(): got client object');
      client.irc.say('#' + job.target[0].address, job.object.text);
      promise.fulfill();
    }, promise.reject);

    return promise;
  };

  var fetch = function (job) {
    var promise = session.promising();
    promise.fulfill();
    return promise;
  };

  var cleanup = function (job) {
    var promise = session.promising();
    promise.fulfill();
    return promise;
  };

  return {
    schema: schema,
    init: init,
    update: update,
    join: join,
    send: send,
    fetch: fetch,
    cleanup: cleanup
  };
};

module.exports = IRC;