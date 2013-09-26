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
    console.log(' [client manager:'+platform+':'+sessionId+'] add ' + key);
    if (!clients[platform]) {
      clients[platform] = {};
    }

    if (clients[platform][key]) {
      clients[platform][key].references = clients[platform][key].references.push(sessionId);
    } else {
      if (typeof client.end !== 'function') {
        throw new Error('client must provide an end() function');
      }
      clients[platform][key] = {
        client: client,
        references: []
      };
      clients[platform][key].references.push(sessionId);
    }
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
    } else if ((clients[platform][key]) && (clients[platform][key].references.length <= 1)) {
      console.log(' [client manager:'+platform+':'+sessionId+'] removal ' + key + ' [count:' +
                  clients[platform][key].references.length + '] ', clients[platform]);

      setTimeout(function () {
        //console.log('ATTEMPTING CHECK: ['+platform+']['+key+']: ', clients[platform]);
        if ((!clients[platform]) || (!clients[platform][key])) {
          console.warn(' [client manager] skipping duplicate removals, should not arrive here');
        } else if (clients[platform][key].references.length <= 1) {
          // end client
          try {
            console.log(' [client manager]:'+platform+':'+sessionId+'] ending client ' + key);
            clients[platform][key].client.end();
          } catch (e) {
            console.error(' [client manager] client.end() failed: ',e);
            throw new Error(e);
          }
          setTimeout(function () {
            delete clients[platform][key].client;
            clients[platform][key].listeners = 0;
            delete clients[platform][key].listeners;
            delete clients[platform][key];
          }, 0);
        } else {
          // someone jumped on and grabbed this client, remove sessionId from
          // the references array
          clients[platform][key].references.splice(clients[platform][key].references.indexOf(sessionId), 1);
          console.log(' [client manager:'+platform+':'+sessionId+'] client spoken for, aborting removal. decreasing count [count: ' +
                      clients[platform][key].references.length + ']');
        }
      }, 20000); // delay for 20s
    } else if (clients[platform][key]) {
      // someones still using this clients, just remove sessionId from the
      // references array
      clients[platform][key].references.splice(clients[platform][key].references.indexOf(sessionId), 1);
    }
  };

  ClientManager.prototype.get = function (platform, key) {
    //console.log('*** CM.get: ['+platform+' : '+key+']', clients);
    if (!clients[platform]) {
      clients[platform] = {};
    } else if (clients[platform][key]) {
      return clients[platform][key].client;
    }
    return undefined;
  };

  ClientManager.prototype.exists = function (platform, key) {
    if (!clients[platform]) {
      clients[platform] = {};
      return false;
    }
    return (clients[platform][key]) ? true : false;
  };

  ClientManager.prototype.referenceCount = function (key) {
    if (!clients[platform]) {
      clients[platform] = {};
      return 0;
    }
    return (clients[platform][key]) ? clients[platform][key].references.length : 0;
  };

  ClientManager.prototype.getKeys = function (platform, sessionId) {
    if (!clients[platform]) {
      clients[platform] = {};
      return [];
    }
    var keys = [];
    for (var key in clients[platform]) {
      if (clients[platform][key].references.indexOf(sessionId) >= 0) {
        // this client was used by this session
        keys.push(key);
      }
    }
    return keys;
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
      throw new Error(' [client manager:' + platform + ':' + sessionId +
                      '] add requires two params: key, client (obj)');
    }
    return cm.add.call(cm, platform, sessionId, key, client);
  };

  o.remove = function (key) {
    if (!key) {
      throw new Error(' [client manager:' + platform + ':' + sessionId +
                      '] remove requires key');
    }
    return cm.remove.call(cm, platform, sessionId, key);
  };

  o.get = function (key) {
    return cm.get.call(cm, platform, key);
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
  return o;
}


module.exports = function (platform, sessionId) {
  console.debug(' [client manager] constructor called with [platform:'+platform+', sessionId:'+sessionId+']');

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