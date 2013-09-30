/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
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

var idCounter = 0;
function nextId() {
  return ++idCounter;
}

var Xmpp = function() {
  var session = '',
      sessionId = '';

  function jidStripResource(jid) {
    return jid.split('/')[0];
  }



  function registerListeners(client, handlers) {
    session.log('registering listeners for sessionId: ' + sessionId);
    var listeners = {
      stanza: {},
      chat: {},
      buddy: {},
      subscribe: {},
      unsubscribe: {},
      close: {},
      error: {},
      online: {}
    };

    if (!handlers) {
      handlers = {};
    }

    listeners['stanza'][sessionId] = function (stanza) {
      session.log("[session: " + sessionId + "] got XMPP stanza: " + stanza);
      if (stanza.is('iq')) {
        var query = stanza.getChild('query');
        if (query) {
          var entries = query.getChildren('item');
          for (var e in entries) {
            console.log('STANZA ATTRS: ', entries[e].attrs);
            if (entries[e].attrs.subscription === 'both') {
              session.send({
                verb: 'update',
                actor: { address: entries[e].attrs.jid, name: entries[e].attrs.name },
                target: [{ address: client.actor }],
                object: {
                  statusText: '',
                  state: 'offline'
                }
              });

            } else if ((entries[e].attrs.subscription === 'from') &&
                        (entries[e].attrs.ask) && (entries[e].attrs.ask === 'subscribe')) {
              session.send({
                verb: 'update',
                actor: { address: entries[e].attrs.jid, name: entries[e].attrs.name },
                target: [{ address: client.actor }],
                object: {
                  statusText: '',
                  state: 'notauthorized'
                }
              });
            } else {
              /**
               * cant figure out how to know if one of these query stanzas are from
               * added contacts or pending requests
               */
              session.send({
                verb: 'request-friend',
                actor: { address: entries[e].attrs.jid, name: entries[e].attrs.name },
                target: [{ address: client.actor }]
              });
            }
          }
        }
      }
    };
    client.xmpp.on('stanza', listeners['stanza'][sessionId]);

    listeners['chat'][sessionId] = function (from, message) {
      session.log("received chat message from " + from);
      session.send({
        verb: 'send',
        actor: { address: from },
        target: [{ address: client.actor }],
        object: {
          text: message,
          id: nextId()
        }
      });
    };
    client.xmpp.on('chat', listeners['chat'][sessionId]);

    listeners['buddy'][sessionId] = function (from, state, statusText) {
      if (from !== client.actor) {
        session.log('received buddy state update: ' + from + ' - ' + state);
        session.send({
          verb: 'update',
          actor: { address: from },
          target: [{ address: client.actor }],
          object: {
            statusText: statusText,
            state: state
          }
        });
      }
    };
    client.xmpp.on('buddy', listeners['buddy'][sessionId]);

    listeners['subscribe'][sessionId] = function (from) {
      session.log('received subscribe request from ' + from);
      session.send({
        verb: "request-friend",
        actor: { address: from },
        target: [{ address: client.actor }]
      });
    };
    client.xmpp.on('subscribe', listeners['subscribe'][sessionId]);

    listeners['unsubscribe'][sessionId] = function (from) {
      session.log('received unsubscribe request from ' + from);
      session.send({
        verb: "remove-friend",
        actor: { address: 'xmpp' },
        target: [{ address: client.actor }]
      });
    };
    client.xmpp.on('unsubscribe', listeners['unsubscribe'][sessionId]);

    if (handlers.close) {
      listeners['close'][sessionId] = handlers.close;
    } else {
      listeners['close'][sessionId] = function () {
        session.log('received close event with no handler specified');
        session.send({
          verb: 'close',
          actor: { address: client.actor },
          target: [{ address: client.actor }]
        });
        session.log('**** xmpp session for ' + client.fullJid + ' closed');
        session.clientManager.remove(client.fullJid);
      };
    }
    client.xmpp.on('close', listeners['close'][sessionId]);

    if (handlers.error) {
      listeners['error'][sessionId] = handlers.error;
    } else {
      listeners['error'][sessionId] = function (error) {
        try {
          session.log("*** XMPP ERROR (rl): " + error);
        } catch (e) {
          console.log('*** XMPP ERROR (rl catch): ', e);
        }
      };
    }
    client.xmpp.on('error', listeners['error'][sessionId]);

    if (handlers.online) {
      listeners['online'][sessionId] = handlers.online;
    } else {
      listeners['online'][sessionId] = function () {
        console.log('online');
        session.log('reconnectioned ' + client.fullJid);
      };
    }
    client.xmpp.on('online', listeners['online'][sessionId]);

    session.log('finished registering listeners for sessionId: ' + sessionId);
    return listeners;
  }



  // merge new set of listeners with possibly already existing listeners
  // attached to a client + session
  function mergeListeners(client, listeners) {
    if (typeof client.listeners !== 'object') {
      client.listeners = listeners;
    }

    for (var type in listeners) {
      for (var listener in listeners[type]) {
        client.listeners[type][listener] = listeners[type][listener];
      }
    }
  }



  function connect(client) {
    var promise = session.promising();
    var handlers = {}; // preset handlers to pass to registerListeners

    handlers['error'] = function (error) {
      var msg = 'failed connecting '+client.fullJid;
      if (error) {
        msg = msg + ' : '+ error;
      }

      try {
        session.log("*** XMPP ERROR (connect error): " + error);
        client.end();
        promise.reject(msg);
      } catch (e) {
        console.log('*** XMPP ERROR (connect error): failed rejecting promise ', e);
        throw new Error(e);
      }
    };

    handlers['online'] = function () {
      session.log('online now with jid: ' + client.fullJid);

      try {
        // save client to clientManager and complete promise
        session.clientManager.add(client.fullJid, client);
        promise.fulfill(client);
      } catch (e) {
        throw new Error(e);
      }
    };

    handlers['close'] = function () {
      // FIXME
      console.log('XMPP: close received for ' + client.fullJid);
      session.clientManager.remove(client.fullJid);
    };

    mergeListeners(client, registerListeners(client, handlers));

    //client.xmpp.on('online', client.listeners['online'][sessionId]);

    client.xmpp.connect(client.xmpp_creds);
    session.log('sent XMPP connect for account ', client.fullJid);
    return promise;
  }



  function getClient(actor) {
    session.log('getClient called');
    var promise = promising();

    var bareJid, fullJid;

    session.getConfig('credentials').then(function (credentials) {
      //
      // get credentials
      session.log('got config for ' + actor);
      if (typeof credentials[actor] === 'undefined') {
        promise.reject('unable to get credentials for ' + actor);
      } else {
        var creds = credentials[actor]; // this actors creds

        //
        // generate bareJid and fullJid
        if (creds.username.indexOf('@') === -1) {
          bareJid = creds.username + '@' + creds.server;
        } else {
          bareJid = creds.username;
        }
        var fullJid = bareJid + '/' + creds.resource;
        session.log('fullJid: ' + fullJid);

        //
        // check if client object already exists
        var client = session.clientManager.get(fullJid, creds);
        if (!client) {
          //
          // create new connection
          session.log('creating new client for '+ fullJid);
          if (typeof(xmpp) !== 'object') {
            xmpp = require('simple-xmpp');
          }

          //
          // credential object to pass to simple-xmpp
          var simple_xmpp_creds = {
            jid: fullJid,
            password: creds.password
          };
          if (creds.server) {
            simple_xmpp_creds.host = creds.server;
          }
          if (creds.port) {
            simple_xmpp_creds.port = creds.port;
          }

          //
          // perform xmpp connect attempt, pass along resulting promise
          // (client object)
          connect({
            xmpp: xmpp,
            credentials: creds,
            xmpp_creds: simple_xmpp_creds,
            fullJid: fullJid,
            actor: actor,
            end: function () {
              session.log('should be CLOSING connection now, NOT IMPLEMENTED in node-xmpp');
              //this.xmpp.close();

              // FIXME - remove all listeners
              //
              // if (typeof client.listeners === 'object') {
              //   for (var key in client.listeners) {
              //     console.log(' [platform:xmpp] removing event listeners for session [' + sessionId + ']: ' + key);
              //     client.xmpp.removeListener(key);
              //   }
              // }
            }
          }).then(promise.fulfill, promise.reject);
        } else {

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
  function init(sess) {
    session = sess;
    promising = session.promising;
    sessionId = sess.getSessionID();

    var promise = session.promising();
    promise.fulfill();
    return promise;
  }



  function cleanup() {
    var promise = session.promising();
    session.log('cleanup called for ' + session.getSessionID());

    //
    //  for now we don't need to worry about ending out client sessions, as
    // long as we provide 'end' callbacks, the sessionManager can close them
    // up automatically
    //
    /*if (fullJid) {
      CM.remove(fullJid).then(function () {
        promise.fulfill();
      }, function () {
        promise.reject('failed to clear session');
      });
    } else {
      promise.fulfill();
    }*/

    //
    // FIXME althoug we could set the presence to invisible. and provide
    // listeners to store the messages instance of try to send them to a session
    //
    promise.fulfill();
    return promise;
  }



  function update(job) {
    var promise = session.promising();

    var show = job.object.show === 'available' ? 'chat' : job.object.show;
    var status = job.object.status || '';

    session.log('update(): [show state: ' + show + '] [status text:' + status + ']');

    getClient(job.actor.address).then(function (client) {

      //
      // setting presence
      session.log('setting presence: ' + show + ' status: ' + status);
      client.xmpp.setPresence(show, status);
      session.log('requesting XMPP roster');
      client.xmpp.getRoster();
      /*if (job.object.roster) {
        _.session.log('requesting roster list');
        client.xmpp.getRoster();
      }*/

      promise.fulfill();
    }, promise.reject);

    return promise;
  }



  function send(job) {
    var promise = session.promising();
    session.log('send() called');

    getClient(job.actor.address).then(function (client) {

      //
      // send message
      session.log('sending message to ' + job.target[0].address);
      xmpp.send(
          job.target[0].address,
          job.object.text
      );
      promise.fulfill();
    }, promise.reject);

    return promise;
  }



  function requestFriend(job) {
    var promise = session.promising();
    session.log('requestFriend() ',job);

    getClient(job.actor.address).then(function (client) {
      session.log('friend request to ' + job.target[0].address);
      client.xmpp.subscribe(
          job.target[0].address
      );
      promise.fulfill();
    }, promise.reject);

    return promise;
  }



  function removeFriend(job) {
    var promise = promising();
    session.log('removeFriend() ',job);

    getClient(job.actor.address).then(function (client) {
      session.log('friend removal of ' + job.target[0].address);
      client.xmpp.unsubscribe(
          job.target[0].address
      );
      promise.fulfill();
    }, promise.reject);

    return promise;
  }



  function makeFriend(job) {
    var promise = session.promising();
    session.log('makeFriend() ',job);

    getClient(job.actor.address).then(function (client) {
      session.log('friend request confirmation to ' + job.target[0].address);
      client.xmpp.acceptSubscription(
          job.target[0].address
      );
      promise.fulfill();
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
                  "properties" : {
                    "address" : {
                      "name" : "address",
                      "required" : true,
                      "type": "string"
                    },
                    "name" : {
                      "name" : "name",
                      "required" : false,
                      "type": "string"
                    }
                  }
                },
                "username" : {
                  "name" : "username",
                  "required" : true,
                  "type": "string"
                },
                "password" : {
                  "name" : "password",
                  "required" : true,
                  "type": "string"
                },
                "server" : {
                  "name" : "server",
                  "required" : true,
                  "type": "string"
                },
                "resource" : {
                  "name" : "resource",
                  "required" : true,
                  "type": "string"
                },
                "port": {
                  "name": "port",
                  "required": false,
                  "type": "number"
                }
              }
            }
          }
        }
      }
    }
  };


  /**
   * List of commands exposed by this platform to the listener
   */
  return {
    schema: schema,
    init: init,
    cleanup: cleanup,
    update: update,
    send: send,
    'request-friend': requestFriend,
    'remove-friend': removeFriend,
    'make-friend': makeFriend
  };

};

module.exports = Xmpp;