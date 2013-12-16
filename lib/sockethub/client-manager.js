// helper function to compare two obejcts together
function compareObjects(one, two) {
  var msg;
  function isInArray(val, array) {
    if (!typeof array.length) {
      //console.log('array length:'+array.length+' typeof: '+typeof array.length+' data:',array);
      //msg = 'isInArray() array has no length.';
      return false;
    }
    for (var i = 0, num = array.length; i < num; i++) {
      if (typeof val === 'function') {
        if (''+array[i] === ''+val) {
          return true;
        }
      } else {
        if (array[i] === val) {
          return true;
        }
      }
    }
    return false;
  }

  function isEqual(a, b) {
    var p;
    for(p in a){
      if (b === undefined) { return false; }
      var av, bv;
      try {
        av = a[p], bv = b[p];
      } catch(e) {
        //console.log('DEBUG', a);
        msg = p + ": "+ a[p]+" doesn't match with second object property";
        return false;
      }
      //recursion
      if (typeof av === 'object' || typeof bv === 'object') {
        if (compareObjects(av,bv) !== true){
          return false;
        }
      } else { //simple comparisons
        if(a[p] !== b[p]){
          // support for arrays of different order
          if (!isInArray(a[p],b)) {
            if (!msg) {
              msg = p + ": "+ a[p]+" not in second object";
            }
            return false;
          }
        }
      }
    }
    return true;
  }

  // can't use json encoding in case objects contain functions - recursion will fail
  // can't compare non-objects
  if (isEqual(one,two) !== true) { console.error(' [client manager] ' + msg); return false; }
  if (isEqual(two,one) !== true) { console.error(' [client manager] ' + msg); return false; }
  return true;
}


var ClientManagerWrapper = (function () {
  var clients = {};


  /**
   * Constructor: ClientManager
   *
   * The singleton object responsible for keeping aclient session alive for
   * retreival by the same platform later (maybe a client refresh?)
   *
   */
  function ClientManager(platform) {
    if (!clients[platform]) {
      clients[platform] = {};
    }
  }


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
  ClientManager.prototype.add = function (platform, sessionId, key, client) {
    console.debug(' [client manager:add:' + platform + ':' + sessionId + '] add ' + key);
    if (!clients[platform]) {
      clients[platform] = {};
    }

    if (!clients[platform][key]) {
      if (typeof client.end !== 'function') {
        throw new Error('client must provide an end() function');
      }
      if (typeof client.credentials !== 'object') {
        throw new Error('client must provide a credentials object in order to' +
                        ' retreive the client object with another session, even if it\'s empty.');
      }
      client.key = key;
      clients[platform][key] = {
        client: client,
        references: {}
      };
    }
    clients[platform][key].references[sessionId] = true;
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
  ClientManager.prototype.remove = function (platform, sessionId, key) {
    if (!clients[platform]) {
      clients[platform] = {};
      return;
    } else if ((clients[platform]) && (clients[platform][key])) {
      // first thing is we decrese the count
      delete clients[platform][key].references[sessionId];
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
          // end client
          try {
            console.info(' [client manager:remove:' + platform + ':' + sessionId +
                         '] ending client ' + key);
            console.debug(' [client manager:remove] references: ', clients[platform][key].references);
            clients[platform][key].client.end();
          } catch (e) {
            console.error(' [client manager:remove] client.end() failed: ', e);
            throw new Error(e);
          }
          setTimeout(function () {
            try {
              delete clients[platform][key].client;
              clients[platform][key].listeners = 0;
              delete clients[platform][key].listeners;
              delete clients[platform][key];
            } catch (e) {
              console.error(e);
            }
          }, 0);
        } else {
          // someone jumped on and grabbed this client
          console.debug(' [client manager:remove:'+platform+':'+sessionId+'] client \'' +
                      key + '\' spoken for, aborting removal.',
                      clients[platform][key].references);
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
   *   key - unique name to lookup client
   *   creds     - credential object set by client for the session, (can be
   *               retreived within a platform with session.getConfig('credentials'))
   *
   * Returns:
   *
   *   client object or undefined
   */
  ClientManager.prototype.get = function (platform, sessionId, key, creds) {
    if ((!key) || (!creds)) {
      console.error(' [client manager:get:' + platform + ':' + sessionId +
                    '] get needs two parameters key and credentials');
      return undefined;
    }

    // console.log('*** CM.get: ['+platform+' : '+key+']', clients);
    if (!clients[platform]) {
      clients[platform] = {};
      return undefined;
    } else if (!clients[platform][key]) {
      return undefined;
    }

    if (!creds) {
      creds = {};
    }

    // if (typeof clients[platform][key].references !== 'object') {
    //   clients[platform][key].references = {};
    // }

    // console.debug('credentials: ', clients[platform][key].client.credentials);
    // console.debug('creds: ', creds);

    var client = clients[platform][key].client;

    //
    // compare clients credentials with current sessions
    //
    if (compareObjects(creds, client.credentials)) {
      //
      // credential match for client, return client object
      //
      clients[platform][key].references[sessionId] = true;
      console.info(' [client manager:get:' + platform + ':' + sessionId +
                   '] credentials match, returning existing client. count: ' +
                   ClientManager.prototype.referenceCount(platform, key));

      return client;
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
  ClientManager.prototype.move = function (platform, sessionId, oldkey, oldcreds, newkey, newcreds) {
    if ((!oldkey) || (!newkey) || (!oldcreds)) {
      console.error(' [client manager:move:' + platform + ':' + sessionId +
                    '] move needs at least three parameters oldkey, credentials, and newkey');
      return undefined;
    }

    var client = ClientManager.prototype.get(platform, sessionId, oldkey, oldcreds);

    if (!client) {
      return false;
    }
    if (newcreds) {
      client.credentials = newcreds;
    }

    var references = clients[platform][oldkey].references;
    var listeners = clients[platform][oldkey].listeners;
    clients[platform][newkey] = {
      client: client,
      references: references,
      listeners: listeners
    };
    delete clients[platform][oldkey].client;
    clients[platform][oldkey].listeners = 0;
    delete clients[platform][oldkey].listeners;
    delete clients[platform][oldkey];
    //ClientManager.prototype.add(platform, sessionId, newkey, client);

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
    if (!clients[platform]) {
      clients[platform] = {};
      return false;
    }
    return (clients[platform][key]) ? true : false;
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
    if (!clients[platform]) {
      clients[platform] = {};
      return 0;
    }
    var count = Object.keys(clients[platform][key].references).length;
    //console.debug(' [client manager] client '+key+' reference count: ' + count);
    //console.debug(' [client manager] '+key+' references: ', clients[platform][key].references);
    return (clients[platform][key]) ? Object.keys(clients[platform][key].references).length : 0;
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
  ClientManager.prototype.getKeys = function (platform, sessionId) {
    if (!clients[platform]) {
      clients[platform] = {};
      return [];
    }
    var keys = [];
    for (var key in clients[platform]) {
      if ((typeof clients[platform][key].references === 'object') &&
          (ClientManager.prototype.referenceCount(platform, key) >= 0)) {
        // this client was used by this session
        keys.push(key);
      }
    }
    return keys;
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
   *   connection - name of the property on the client object which has the
   *                session connection, shouldh have a removeListener function
   *                on it.
   *
   * Returns:
   *
   *   return description
   */
  ClientManager.prototype.removeListeners = function (platform, sessionId, key, connection) {
    console.debug(' [client manager:removeListeners:'+platform+':'+sessionId+'] called: '+key+':'+connection);
    if (!clients[platform]) {
      clients[platform] = {};
      return;
    }

    if ((!key) || (!connection)) {
      console.error(' [client manager:removeListeners] requires a key and connection paramater');
    }

    if ((!clients[platform][key]) || (!clients[platform][key].client.listeners)) {
      return;
    }

    var client = clients[platform][key].client;

    //
    // if we have listeners for this session, we need to remove them
    // from the simple-xmpp eventemitter
    if (typeof clients[platform][key].client.listeners === 'object') {
      //console.log('CLIENT LISTENERS: ', client.listeners);
      for (var type in clients[platform][key].client.listeners) {
        //console.debug('CLIENT LISTENERS ['+type+']: ', client[connection].listeners(type));
        for (var listener in clients[platform][key].client.listeners[type]) {

          if (typeof clients[platform][key].client.listeners[type][listener] !== 'function') {
            console.error('[client manager:removeListeners] why isnt ['+listener+'] a function ? [' +
                          typeof clients[platform][key].client.listeners[type][listener] +
                          ']:', clients[platform][key].client.listeners[type][listener]);
          } else {
            if (typeof clients[platform][key].client[connection].removeListener !== 'function') {
              console.error(' [client manager:removeListeners:' + platform + ':' + sessionId + '] need a cliet[platform].removeListener function');
            } else {
              console.debug(' [client manager:removeListeners:' + platform + ':' + sessionId + '] removing ' + type +
                        ' event listeners for session [' + sessionId +
                        ']');
              clients[platform][key].client[connection].removeListener(
                      type,
                      clients[platform][key].client.listeners[type][listener]
              );
            }
          }
          delete clients[platform][key].client.listeners[type][listener];
        }
      }
    }
  };

  return ClientManager;
})();



var instances = {};
var cm;


/**
 * Function: CMSession
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
 *   platform  - platform name
 *   sessionId - sessionId string
 *
 * Returns:
 *
 *   CMSession object
 */
function CMSession(platform, sessionId) {
  var o = {};
  o.add = function (key, client) {
    if ((!key) || (!client)) {
      throw new Error(' [client manager:add:' + platform + ':' + sessionId +
                      '] add requires two params: key, client (obj)');
    }
    return cm.add.call(cm, platform, sessionId, key, client);
  };

  o.remove = function (key) {
    if (!key) {
      throw new Error(' [client manager:remove:' + platform + ':' + sessionId +
                      '] remove requires key');
    }
    return cm.remove.call(cm, platform, sessionId, key);
  };

  o.get = function (key, creds) {
    return cm.get.call(cm, platform, sessionId, key, creds);
  };

  o.move = function (oldkey, oldcreds, newkey, newcreds) {
    return cm.move.call(cm, platform, sessionId, oldkey, oldcreds, newkey, newcreds);
  };

  o.exists = function (key) {
    return cm.exists.call(cm, platform, key);
  };

  o.referenceCount = function (key) {
    return cm.referenceCount.call(cm, platform, key);
  };

  o.getKeys = function () {
    return cm.getKeys.call(cm, platform, sessionId);
  };

  o.removeListeners = function (key, connection) {
    return cm.removeListeners.call(cm, platform, sessionId, key, connection);
  };
  return o;
}


module.exports = function (platform, sessionId) {
  // console.debug(' [client manager] constructor called with [platform:' +
  //               platform + ', sessionId:' + sessionId + ']');

  if (!cm) {
    cm = new ClientManagerWrapper(platform);
  }

  if (!instances[platform]) {
    instances[platform] = {};
  }

  if (!instances[platform][sessionId]) {
    instances[platform][sessionId] = new CMSession(platform, sessionId);
  }

  return instances[platform][sessionId];
};