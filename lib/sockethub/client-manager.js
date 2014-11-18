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

var objectAssert  = require('./utils/object-assert.js');
var ArrayKeys    = require('array-keys');


var ClientManagerWrapper = (function () {
  var clients = {};

  /**
   * Class: ClientManager
   *
   * The singleton object responsible for keeping a client session alive for
   * retreival by the same platform later (maybe a client refresh?)
   *
   */
  function ClientManager(platform) {
    ensureIndex(platform);
  }

  function ensureIndex(platform) {
    if (!clients[platform]) {
      clients[platform] = new ArrayKeys({
        identifier: 'key'
      });
    }
  }

  function registerListeners(key, client, session) {
    var platform  = session.platform,
        sessionId = session.getSessionID();

    function listenerWrapper(listener, sess, c) {
      return function () {
        var args = Array.prototype.slice.call(arguments);
        listener.apply({session: sess, client: c}, args);
      };
    }

    console.debug(' [client manager:create:' + platform + ':' + sessionId +
                  '] registering listeners');

    for (var name in client.listeners) {
      // wrapper for listener callbacks
      if (typeof client.indexedListeners[name] === 'undefined') {
        client.indexedListeners[name] = {};
      } else if (typeof client.indexedListeners[name][sessionId + name] !== 'undefined') {
        // session already registered listeners
        continue;
      } else {
        // new session, register listeners for it
        client.indexedListeners[name][sessionId + name] = listenerWrapper(client.listeners[name], session, client);

        try {
          client.addListener.apply({session: session}, [client, client.key, name, client.indexedListeners[name][sessionId + name]]);
        } catch (e) {
          console.error('ERROR: '+e);
          //return e;
        }
      }
    }
    return client;
  }

  /**
   * Function: create
   *
   * Manages the creation, listener registering, and removal of a client.
   *
   * Parameters:
   *
   *   key - unique identifier of this client connection
   *   creds - credential object retreived from getConfig()
   *   o   - object containing a set of function callbacks for various states
   *         of the client.
   *   cb  - callback function when create is completed, params are:
   *         err (srting, client (object)
   *
   *  ---
   *
   *   o.connect(key, credentials, cb) -
   *         called to establish a connection, should return the client
   *         connection object.
   *
   *   o.listeners(object) -
   *         an object of listeners, the property is the name of the listener,
   *         the value is a function to call when that listener event is fired.
   *
   *   o.addListener(client, key, name, func) -
   *         executed when the clientManager wants to add a listener (ie.
   *         session connect), the name/func pairs will be whatever you've
   *         described in the listeners(object).
   *
   *   o.removeListener(client, key, name, func) -
   *         called when the clientManager wants to remove a listener (ie.
   *         session disconnect).
   *
   *   o.disconnect(client, key, cb) -
   *         called when the clientManager wants to completely destroy the
   *         connection.
   *
   */
  ClientManager.prototype.create = function (session, key, creds, o, cb) {
    var platform  = session.platform,
        sessionId = session.getSessionID();

    console.debug(' [client manager:create:' + platform + ':' + sessionId +
                  '] called');

    ensureIndex(platform);

    if (typeof key !== 'string') {
      console.error(' [client manager:create:' + platform + ':' + sessionId +
                    '] key not defined.');
      return false;
    } else if (typeof creds !== 'object') {
      console.error(' [client manager:create:' + platform + ':' + sessionId +
                    '] credentials not defined.');
      return false;
    } else if (typeof o !== 'object') {
      console.error(' [client manager:create:' + platform + ':' + sessionId +
                    '] object not defined.');
      return false;
    } else if (typeof cb !== 'function') {
      console.error(' [client manager:create:' + platform + ':' + sessionId +
                    '] callback not defined.');
      return false;
    }

    if ((typeof o.connect !== 'function') ||
        (typeof o.listeners !== 'object') ||
        (typeof o.addListener !== 'function') ||
        (typeof o.removeListener !== 'function') ||
        (typeof o.disconnect !== 'function')) {
      console.error(' [client manager:create:' + platform + ':' + sessionId +
                    '] properties of object must be: connect(function ['+typeof o.connect+']) ' +
                    'listeners(object ['+typeof o.listeners+']) addListener(function ['+typeof o.addListener+']) ' +
                    'removeListener(function ['+typeof o.removeListener+']) disconnect(function ['+typeof o.disconnect+'])');
      return false;
    }

    o.timeout = (typeof o.timeout === 'number') ? o.timeout : 6000;

    var client = {
      id: key,
      key: key,
      credentials: creds,
      listeners: o.listeners,
      indexedListeners: {},
      addListener: o.addListener,
      removeListener: o.removeListener,
      disconnect: o.disconnect,
      conn: undefined
    };

    console.debug(' [client manager:create:' + platform + ':' + sessionId + '] calling client.connect()');

    // call provided connect function
    o.connect.apply({session: session}, [key, creds, function (err, c) {
      if (err) {
        // error with client connection
        console.debug(' [client manager:create:' + platform + ':' + sessionId +
                  '] error: ', err);
        cb(err);
      }
      client.conn = c;
      console.info(' [client manager:create:' + platform + ':' + sessionId +
                    '] client creation complete.');

      client = registerListeners(key, client, session);

      ClientManager.prototype.add(session, key, client);
      try {
        cb(null, client);
      } catch (e) {
        console.error(' [client manager:create:' + platform + ':' + sessionId +
                      '] failed callback upon completion: ' + e);
      }
    }]);
  };


  /**
   * Function: add
   *
   * adds a client to the index based on key. incrementing the reference count
   * for already added clients.
   *
   * Parameters:
   *
   *   key - unique name to lookup client
   *   client - the client object that contains the connection
   *
   */
  ClientManager.prototype.add = function (session, key, client) {
    var platform  = session.platform,
        sessionId = session.getSessionID();
    console.debug(' [client manager:add:' + platform + ':' + sessionId + '] add ' + key);

    ensureIndex(platform);

    var record = clients[platform].getRecord(key);
    var completeRecord;
    if (!record) {
      // adding new record, verify it has some basic things
      if (typeof client.disconnect !== 'function') {
        throw new Error('client must provide an disconnect() function');
      }
      if (typeof client.credentials !== 'object') {
        throw new Error('client must provide a credentials object in order to' +
                        ' retreive the client object with another session, even if it\'s empty.');
      }

      // ensure key index
      client.key = key;

      // the client is actually a sub-object, so we make sure it also has key
      // and references here.
      completeRecord = {
        key: key,
        client: client,
        references: new ArrayKeys({
          identifier: 'sid'
        }),
        listeners: {}
      };
    } else {
      completeRecord = record;
    }

    completeRecord.references.addRecord(session);
    clients[platform].addRecord(completeRecord);
  };


  /**
   * Function: remove
   *
   * removes the client completely if there are no more references, otherwise,
   * it decrements the reference count by 1
   *
   * there is a 20s delay for complete removal of the object, to account for
   * page refreshes.
   *
   * Parameters:
   *
   *   key - unique name to lookup client
   *
   */
  ClientManager.prototype.remove = function (session, key) {
    var platform  = session.platform,
        sessionId = session.getSessionID();

    ensureIndex(platform);

    var record = clients[platform].getRecord(key);
    if (record) {
      // first thing is we decrese the count by removing the session
      record.references.removeRecord(sessionId);
    } else {
      return;
    }

    console.debug(' [client manager:remove:' + platform + ':' + sessionId +
                  '] removal of ' + key + '. decreased count: ' +
                  ClientManager.prototype.referenceCount(platform, key));
                  // , clients[platform]);

    if (ClientManager.prototype.referenceCount(platform, key) <= 0) {
      //
      // if the removal of our session reference brings the count to 0, then we
      // initiate the timeout for actual removal check
      //
      setTimeout(function () {
        // console.log('ATTEMPTING CHECK: ['+platform+']['+key+']: ', clients[platform]);
        if ((!clients[platform]) || (!clients[platform][key])) {
          console.warn(' [client manager:remove] skipping duplicate removals, should not arrive here');
        } else if (ClientManager.prototype.referenceCount(platform, key) <= 0) {
          // disconnect client
          try {
            console.info(' [client manager:remove:' + platform + ':' + sessionId +
                         '] ending client ' + key);
            console.debug(' [client manager:remove] references: ', record.references.getIdentifiers());
            record.client.disconnect.apply({session: session}, record.client, key, function () {
              try {
                //delete record.client;
                //record.listeners = 0;
                clients[platform].removeRecord(record.key);
                //delete clients[platform][key].listeners;
                //delete clients[platform][key];
              } catch (e) {
                console.error(e);
              }
            });
          } catch (e) {
            console.error(' [client manager:remove] client.disconnect() failed: ', e);
            throw new Error(e);
          }
        } else {
          // someone jumped on and grabbed this client
          console.debug(' [client manager:remove:' + platform + ':' + sessionId +
                        '] client \'' + key + '\' spoken for, aborting removal.');
        }
      }, 20000); // delay for 20s
    }
  };


  /**
   * Function: get
   *
   * given a key and credential object, the get function will send back an existing
   * client object if one was found under the given key name, and also if the
   * credential objects match.
   *
   * Parameters:
   *
   *   key       - unique name to lookup client
   *   creds     - credential object set by client for the session, (can be
   *               retreived within a platform with session.getConfig('credentials'))
   *
   * Returns:
   *
   *   client object or undefined
   */
  ClientManager.prototype.get = function (session, key, creds) {
    var platform  = session.platform,
        sessionId = session.getSessionID();

    if ((!key) || (!creds)) {
      console.error(' [client manager:get:' + platform + ':' + sessionId +
                    '] get needs two parameters key and credentials');
      return undefined;
    }

    console.debug(' [client manager:get:' + platform + ':' + sessionId +
                  '] getting client object ' + key);


    ensureIndex(platform);
    var record = clients[platform].getRecord(key);
    console.log('GET COMPLETED: ', record);
    console.log('GET COMPLETED: ', clients[platform]);
    if (!record) {
      return undefined;
    }

    if (!creds) {
      creds = {};
    }

    var client = record.client;

    // delete creds.sessionId;
    // delete creds.rid;

    //
    // compare clients credentials with current sessions
    //
    if (objectAssert(creds, client.credentials)) {
      //
      // credential match for client, return client object
      //
      record.references.addRecord(session);
      console.info(' [client manager:get:' + platform + ':' + sessionId +
                   '] credentials match, returning existing client. count: ' +
                   ClientManager.prototype.referenceCount(platform, key));

      clients[platform].addRecord(record);
      return registerListeners(key, client, session);
    } else {
      console.log('ClientManager.get CREDENTIALS DO NOT MATCH');
      console.debug('client object credentials: ', client.credentials);
      console.debug('passed in credentials: ', creds);
    }

    console.warn(' [client manager:get:' + platform + ':' + sessionId +
                 '] credentials do not match, rejecting');
    return undefined;
  };


  /**
   * Function: move
   *
   * moves a client object from one key lookup to another, useful for cases
   * where the 'key' is a username that changes after the initial creation of
   * the client object
   *
   * Parameters:
   *
   *   oldkey    - existing key to retreive the client object
   *   oldcreds  - credential object set by client for the session, (can be
   *               retreived within a platform with session.getConfig('credentials'))
   *   newkey    - new key to move the client object to
   *   newcreds  - [optional] updated credential object, if not specified existing
   *               credentials will remain unchanged
   *
   * Returns:
   *
   *   boolean
   */
  ClientManager.prototype.move = function (session, oldkey, oldcreds, newkey, newcreds) {
    var platform  = session.platform,
        sessionId = session.getSessionID();

    if ((!oldkey) || (!newkey) || (!oldcreds)) {
      console.error(' [client manager:move:' + platform + ':' + sessionId +
                    '] move needs at least three parameters oldkey, credentials, and newkey');
      return undefined;
    }

    console.debug(' [client manager:move:' + platform + ':' + sessionId +
                    '] attempting move of '+oldkey+ ' to '+newkey, oldcreds);

    var client = ClientManager.prototype.get(session, oldkey, oldcreds);

    if (!client) {
      return false;
    }

    if (newcreds) {
      client.credentials = newcreds;
    }

    //delete client.credentials.sessionId;
    //delete client.credentials.rid;
    var oldRecord   = clients[platform].getRecord(oldkey);
    var references  = oldRecord.references;
    var listeners   = oldRecord.listeners;

    var newRecord = {
      key: newkey,
      client: client,
      references: references,
      listeners: listeners
    };
    clients[platform].addRecord(newRecord);

    clients[platform].removeRecord(oldkey);
    // delete clients[platform][oldkey].client;
    // clients[platform][oldkey].listeners = 0;
    // delete clients[platform][oldkey].listeners;
    // delete clients[platform][oldkey];

    return true;
  };


  /**
   * Function: exists
   *
   * returns a boolean indicating whether or not the given key has a client
   *
   * Parameters:
   *
   *   key - unique name to lookup client
   *
   * Returns:
   *
   *   boolean
   */
  ClientManager.prototype.exists = function (platform, key) {
    ensureIndex(platform);
    var record = clients[platform].getRecord(key);
    if (record) {
      return true;
    } else {
      return false;
    }
  };


  /**
   * Function: referenceCount
   *
   * returns number of refernences for a given key
   *
   * Parameters:
   *
   *   key - unique name to lookup client
   *
   * Returns:
   *
   *   number
   */
  ClientManager.prototype.referenceCount = function (platform, key) {
    ensureIndex(platform);
    var record = clients[platform].getRecord(key);
    if (!record) {
      return 0;
    }
    //var count = Object.keys(clients[platform][key].references).length;
    //console.debug(' [client manager] client '+key+' reference count: ' + count);
    //console.debug(' [client manager] '+key+' references: ', clients[platform][key].references);
    return record.references.getCount();
  };


  /**
   * Function: getKeys
   *
   * returns all keys existing for the calling platform
   *
   * Parameters:
   *
   *   none
   *
   * Returns:
   *
   *   array of strings
   */
  ClientManager.prototype.getKeys = function (session) {
    var platform  = session.platform,
        sessionId = session.getSessionID();

    ensureIndex(platform);

    return clients[platform].getIdentifiers();
  };


  /**
   * Function: removeListeners
   *
   * given a key and connection name (the name of the connection object attached
   * to the client object. for exaple 'xmpp' is the name of the xmpp session
   * attached to the client in the platform module). The connection reference
   * should have a removeListener function on it.
   *
   * Parameters:
   *
   *   key - unique name to lookup client
   *
   * Returns:
   *
   *   return description
   */
  ClientManager.prototype.removeListeners = function (session, key) {
    var platform  = session.platform,
        sessionId = session.getSessionID();
    console.debug(' [client manager:removeListeners:' + platform + ':' + sessionId + '] called: ' + key);

    ensureIndex(platform);

    if (!key) {
      console.error(' [client manager:removeListeners] requires a key paramater');
    }

    var record = clients[platform].getRecord(key);
    if ((!record) || (!record.client.listeners)) {
      return;
    }

    var client = record.client;

    //
    // if we have listeners for this session, we need to remove them
    // from the simple-xmpp eventemitter
    if (typeof client.listeners === 'object') {
      //console.log('CLIENT LISTENERS: ', client.listeners);
      for (var type in client.listeners) {
        //console.debug('CLIENT LISTENERS ['+type+']: ', client.conn.listeners(type));
        for (var listener in client.listeners[type]) {

          if (typeof client.listeners[type][listener] !== 'function') {
            console.error('[client manager:removeListeners] why isnt ['+listener+'] a function ? [' +
                          typeof client.listeners[type][listener] +
                          ']:', client.listeners[type][listener]);
          } else {
            if (typeof client.conn.removeListener !== 'function') {
              console.error(' [client manager:removeListeners:' + platform + ':' + sessionId + '] need a cliet[platform].removeListener function');
            } else {
              console.debug(' [client manager:removeListeners:' + platform + ':' + sessionId + '] removing ' + type +
                        ' event listeners for session [' + sessionId +
                        ']');
              client.conn.removeListener(
                      key,
                      type,
                      client.listeners[type][listener]
              );
            }
          }
          delete client.listeners[type][listener];
        }
      }
    }
  };

  return ClientManager;
})();



var instances = {};
var cm;


/*
 * Wrapper: CMSession
 *
 * the CMSession object is essentially a wrapper for the ClientManager to
 * protect persistent information from other platforms. So a platform cannot
 * hijack another platforms client instance (an xmpp connection, for example)
 *
 * it curries all the functions of the ClientManager singleton with platform
 * and sessionId, making the interface very simple for the platform user.
 *
 * Parameters:
 *
 *   platform  - platform session object
 *
 * Returns:
 *
 *   CMSession object
 */
function CMSession(session) {
  var platform  = session.platform,
      sessionId = session.getSessionID(),
      o         = {
        sid: sessionId
      };

  o.create = function (key, credentials, o, cb) {
    return cm.create.call(cm, session, key, credentials, o, cb);
  };

  o.add = function (key, client) {
    if ((!key) || (!client)) {
      throw new Error(' [client manager:add:' + platform + ':' + sessionId +
                      '] add requires two params: key, client (obj)');
    }
    return cm.add.call(cm, session, key, client);
  };

  o.remove = function (key) {
    if (!key) {
      throw new Error(' [client manager:remove:' + platform + ':' + sessionId +
                      '] remove requires key');
    }
    return cm.remove.call(cm, session, key);
  };

  o.get = function (key, creds) {
    return cm.get.call(cm, session, key, creds);
  };

  o.move = function (oldkey, oldcreds, newkey, newcreds) {
    return cm.move.call(cm, session, oldkey, oldcreds, newkey, newcreds);
  };

  o.exists = function (key) {
    return cm.exists.call(cm, platform, key);
  };

  o.referenceCount = function (key) {
    return cm.referenceCount.call(cm, platform, key);
  };

  o.getKeys = function () {
    return cm.getKeys.call(cm, session);
  };

  o.removeListeners = function (key, connection) {
    return cm.removeListeners.call(cm, session, key, connection);
  };
  return o;
}


module.exports = function (session) {
  if (typeof session !== 'object') {
    console.error(' [client manager] constructor called without valid session object: ', session);
    throw new Error('[client manager] constructor called without valid session object: ', session);
  }

  var platform  = session.platform,
      sessionId = session.getSessionID();
  // console.debug(' [client manager] constructor called with [platform:' +
  //               platform + ', sessionId:' + sessionId + ']');


  if (!cm) {
    cm = new ClientManagerWrapper(platform);
  }

  if (!instances[platform]) {
    instances[platform] = new ArrayKeys({
      identifier: 'sid'
    });
  }

  var cmSession = instances[platform].getRecord(sessionId);
  if (!cmSession) {
    cmSession = new CMSession(session);
    instances[platform].addRecord(cmSession);
  }

  return cmSession;
};
