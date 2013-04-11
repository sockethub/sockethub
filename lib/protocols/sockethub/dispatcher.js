/**
 * Variable: Dispatcher
 *
 * The dispatcher handles incoming JSON objects from client connections,
 * validates them. Then passes them along to either a local function, if
 * specified in the protocol.js, or most likely puts it into the redis queue for
 * the platforms listener.
 *
 */
var Dispatcher = {
  JSVlib : require('JSV').JSV, // json schema validator
  redis : require('redis'),
  promising : require('promising'),
  Session: '',
  platforms : { remote : {}, local : {}},
  readyState : undefined,
  errorSent : false,
  sessionIdCounter : 0,
  inShutdown: false,
  dispatcherChannel: '',
  sockethubId: ''
};


/**
 * Function: init
 *
 * Loads the protocol.js and verifies it with the scham_protocol.js. Then it
 * fires off a function to subscribe to the dispatchers subsystem channel (which
 * it can receive real-time updates from listeners, ie. in response to a ping
 * request),
 *
 * It then pauses briefly before sending out pings to each platforms listener
 * instance. Just to verify all listeners are accounted for. This currently just
 * takes into account platforms that the sockethub server is directly responsible
 * for. It does not consider that there could be other platforms fired up from
 * other sockethub instances.
 *
 * It then waits a few seconds before checking the local 'this.platforms.remote'
 * object which contains the ping times for send and received. If the received
 * time is less than the sent time, it knows the platform is unresponsive, and
 * srejects the promise, otherwise the promise is fulfulled - so that the
 * calling process' then() functions are called.
 *
 * Returns:
 *
 *   promise - returns a promise which will be fullfilled when init completes
 *             or fails.
 */
Dispatcher.init = function (myPlatforms, sockethubId) {
  // when we get a new connection, and the protocol specified is matched to the
  // list in the config, then this dispatcher is called.
  //
  // first we do basic checking on the protocol.js file to ensure that it's
  // passes basic checks and has the right base-properties.
  this.dispatcherChannel = 'sockethub:' + sockethubId + ':dispatcher:subsystem';
  this.sockethubId = sockethubId;
  this.myPlatforms = myPlatforms; // platforms this dispatcher is responsible for
  this.Session = require('./session')(sockethubId);

  try {
    proto = require("./protocol.js");
  } catch (e) {
    throw 'unable to load sockethub/protocol.js ' + e;
  }
  try {
    protoSchema = require("./protocol_schema.js");
  } catch (e) {
    throw 'unable to load lib/protocols/sockethub/protocol_schema.js ' + e;
  }

  // validate that the protocol.js has the correct format for defining all verbs
  // and platforms with their associated verbs.
  var jsv = this.JSVlib.createEnvironment();
  var report = jsv.validate(proto, protoSchema);
  if (report.errors.length !== 0) {  // protocol.js json errors
    throw 'invalid format in lib/protocols/sockethub/protocol.js : '+
          JSON.stringify(report.errors);
  } else {
    console.debug(' [dispatcher] lib/protocols/sockethub/protocol.js schema validated');
  }


  // verifying the platform sections verbs match the verbs section list, in protocol.js
  for (var p in proto.platforms) {
    for (var v in proto.platforms[p].verbs) {
      if (typeof proto.verbs[v] === 'undefined') {
        throw('invalid verb ' + v + ' defined in ' + p + ' platform schema [protocol.js]');
      }
    }
  }

  // verify all verbs specified in the platforms area are accounted for in the verbs section
  this.getSubSystemChannel();
  var _this = this;
  // ping the platform listeners to see if their active yet
  var i;
  setTimeout(function () {
    for (i = 0, num = myPlatforms.length; i < num; i = i + 1) {
      var key = myPlatforms[i];
      if (typeof proto.platforms[key] === 'undefined') {
        console.error(' [dispatcher] platform ' + key + ' not found in protocol.js schema, skipping');
        continue;
      } else if ((typeof proto.platforms[key].local === 'boolean') &&
          (proto.platforms[key].local)) {
        // don't try to ping local platforms, like the dispatcher itself.
        continue;
      }

      var now = new Date().getTime();
      _this.platforms['remote'][key] = {
        'ping' : {
          'last_sent' : now,
          'last_received' : 0
        }
      };
      Dispatcher.sendSubSystem(key, 'ping', {timestamp: now});
    }
    //console.debug(' [dispatcher] finished sending pings');
  }, 1000);

  var promise = this.promising();

  // check for ping responses
  setTimeout(function () {
    var showedWarning = false;
    for (var key in proto.platforms.remote) {
      if (_this.platforms['remote'][key]['ping']['last_received'] <
                _this.platforms['remote'][key]['ping']['last_sent']) {
        showedWarning = true;
        console.warn(' [dispatcher] WARNING: ' + key + ' platform not responding');
      }
    }

    if (showedWarning) {
      console.warn(' [dispatcher] some platforms may not have initialized properly, please check the logs.');
      promise.reject('some platforms may not have initialized properly, please check the logs.');
    } else {
      console.info(' [dispatcher] sockethub platforms have initialized, all systems go.');
      //console.log('platforms: ', _this.platforms.remote);
      promise.fulfill();
    }
  }, 2000);

  return promise;
};




Dispatcher.sendSubSystem = function (platform, command, obj) {
  var client = this.redis.createClient();
  var channel = 'sockethub:'+this.sockethubId+':listener:' + platform + ':subsystem';
  console.debug(' [dispatcher] subsystem sending ' + command + ' to ' + channel);
  var now = new Date().getTime();
  var _this = this;
  var objData = {
    ping: {
      timestamp: now
    },
    cleanup: {}
  };

  if (obj) {
    objData[command] = obj;
  }
  client.lpush(channel, JSON.stringify({
    verb: command,
    actor: {
      channel: _this.dispatcherChannel
    },
    object: objData[command]
  }));
};


// listens for activity on the dispatcher:subsystem channel, and adds ping data
// a dict of platforms.
Dispatcher.getSubSystemChannel = function () {
  var client1 = this.redis.createClient();
  var _this = this;
  console.info(' [dispatcher] listening on ' + _this.dispatcherChannel);
  client1.blpop(_this.dispatcherChannel, 0, function (err, replies) {
    if (err) {
      console.error(' [dispatcher] received error on channel '+_this.dispatcherChannel);
    } else {
      var data = JSON.parse(replies[1]);
      console.info(' [dispatcher] received ' + data.verb + ' from ' +
                    data.platform + ' on ' + _this.dispatcherChannel);
      if (data.verb === 'ping') {
        var now = new Date().getTime();
        _this.platforms['remote'][data.platform]['ping']['last_received'] = now;
      }
    }

    client1.quit();
    Dispatcher.getSubSystemChannel();
  });
};

Dispatcher.subscribeOutgoing = function (sessionId, callback) {
  var channel = 'sockethub:' + this.sockethubId + ':dispatcher:outgoing:' + sessionId;
  var client;

  function getNext() {
    client = Dispatcher.redis.createClient();
    client.blpop(channel, 0, function(err, incoming) {
      if(err) {
        console.error(" [dispatcher:"+sessionId+"] channel ("+channel+") error: " + err);
      } else {
        console.log(' [dispatcher:'+sessionId+'] channel ('+channel+') '+incoming[1]);
        callback(incoming[1]);
        client.quit();
        getNext();
      }
    });
  }

  getNext();

  console.debug(' [dispatcher:'+sessionId+'] subscribed to channel ' + channel);

  return function() {
    if(client) {
      client.quit();
    }
  };
};


Dispatcher.shutdown = function () {
  var promise = this.promising();

  Dispatcher.inShutdown = true;
  var sids = Dispatcher.Session.getAllSessionIDs();

  var obj = {
    sids: sids
  };
  for (var key in this.platforms.remote) {
    Dispatcher.sendSubSystem(key, 'cleanup', obj);
  }
  var now = new Date().getTime();
  for (key in this.platforms.remote) {
    Dispatcher.sendSubSystem(key, 'ping', {timestamp: now});
  }

  var _this = this;
  var count = 0;
  // check for ping responses
  console.warn(' [dispatcher] waiting for all listeners to respond to ping before we can shutdown');
  (function awaitShutdown() {
    //var promise = Dispatcher.promising();
    var notAllResponded = false;
    //console.log('platform list', _this.platforms);
    for (var i = 0, num = _this.myPlatforms.length; i < num; i = i + 1) {
      var key = _this.myPlatforms[i];
      if ((typeof _this.platforms['remote'][key] !== 'undefined') &&
          (_this.platforms['remote'][key]['ping']['last_received'] !== 0) &&
          (_this.platforms['remote'][key]['ping']['last_received'] < now)) {
        // if this platform has responded to pings before, but not now, then we
        // delay.
        console.warn(' [dispatcher] platform '+key+' hasnt responded to ping');
        notAllResponded = true;
      }
    }

    if ((notAllResponded) && (count < 3)) {
      console.warn(' [dispatcher] not all listeners have responded...');
      count = count + 1;
      setTimeout(awaitShutdown, 1000);
    } else if (count === 3) {
      console.error(' [dispatcher] listeners failed to respond to ping, aborting.');
      promise.reject('listeners failed to respond to ping, aborting.');
    } else {
      var client = _this.redis.createClient();
      var client2 = _this.redis.createClient();
      console.info(' [dispatcher] clearing redis channels');
      client.keys('sockethub:'+_this.sockethubId+':*', function (err, keys) {
        keys.forEach(function (key, pos) {
          console.debug(' [dispatcher] deleting key ' + key);
          client2.del(key);
        });
        console.info(' [dispatcher] ready to shutdown, ', keys);
        //console.log('err:',err);
        client.quit();
        client2.quit();
        promise.fulfill();
      });
    }
  })();
  return promise;
};


/**
 * Function: connect
 *
 * When this websocket gets an incoming message, it calls this function
 *
 * Parameters:
 *
 *   connection - [type/description]
 *
 * Returns:
 *
 *   return description
 */
Dispatcher.connect = function(connection) {
  // now we set up the dispatcher for incoming messages. the dispatcher verifies the
  // verb exists in the protocol and validates it against the schema.
  // if sucessful, it passes it on to the protocols defined function for handling
  // that verb.
  var curry = require('curry');
  var seconds = new Date().getTime();
  this.sessionIdCount = this.sessionIdCount + 1;
  var sessionId = seconds + this.sessionIdCounter;
  var session;
  var errorSent = false;
  var _this = this;

  // XXX i don't understand why @nilclass named this. why it's used as part of cleanup (below).
  var cleanupOutgoing = Dispatcher.subscribeOutgoing(sessionId, function(msg) {
    console.info(' [dispatcher] callback: ', msg);
    connection.sendUTF(msg);
  });

  Dispatcher.Session.get(sessionId).then(function (session) {

    connection.on("close", function() {
      try {
        session.getPlatforms().forEach(function(platform) {
          Dispatcher.sendSubSystem(platform, 'cleanup', {sids: [sessionId]});
        });
        Dispatcher.Session.destroy(sessionId);
        cleanupOutgoing(); // XXX @nilclass: this is the only place cleanupOutgoing called,
                           // and not sure what it does, since there isn't even a msg passed.
        session = undefined;
      } catch(e) {
        console.error(' [dispatcher] failed session cleanup, session already undefined');
      }

    });

    connection.on("message", function (message) {
      errorSent = false;

      //console.debug(' [dispacher] shutdown:'+Dispatcher.inShutdown);
      if (Dispatcher.inShutdown) {
        // shutdown in progress
        console.debug(' [dispatcher:' + sessionId + '] shutdown in progress,' +
                      ' cannot receive new messages');

      } else if (message.type === 'utf8') {
        // incoming message to handle
        console.info(' [dispatcher:' + sessionId + '] received message: ',
                     message.utf8Data);

        var obj = false;
        try {
          obj = JSON.parse(message.utf8Data);
        } catch (e) {
          console.error(' [dispatcher:' + sessionId + '] invalid JSON!');
          sendError(undefined, undefined, undefined, 'invalid JSON received');
          return false;
        }

        var m = []; // list of incomming requests
        if (typeof obj[0] === 'object') { // list of requests
          m = obj;
        } else { // single request
          m[0] = obj;
        }

        for (var i = 0, numObjs = m.length; i < numObjs; i = i + 1) {

          var rid = m[i].rid, platform = m[i].platform, verb = m[i].verb, o = m[i];

          if ((typeof rid !== 'string') &&
             (typeof rid !== 'number')) {
            sendError(undefined, undefined, 'confirm', 'no rid (request ID) specified');
          } else if (typeof platform !== 'string') {
            sendError(rid, undefined, 'confirm', 'no platform specified');
          } else if (typeof verb !== 'string') {
            sendError(rid, platform, 'confirm', 'no verb (action) specified');
          } else if (typeof proto.platforms[platform] !== 'object') {
            sendError(rid, platform, 'confirm', 'unknown platform received: ' + platform);
          } else if (typeof proto.platforms[platform].verbs[verb] !== 'object') {
            sendError(rid, platform, 'confirm', 'unknown verb received: ' + verb);
          } else if (typeof m[i].sessionId !== 'undefined') {
            sendError(rid, platform, 'confirm', 'cannot use name sessionId, reserved property');
          } else if ((!session.isRegistered()) && (o.verb !== 'register')) {
            sendError(rid, platform, 'confirm', 'session not registered, cannot process verb');
          }

          if (errorSent) { return false; }

          var jsv = _this.JSVlib.createEnvironment();
          var report = jsv.validate(o, proto.verbs[verb].schema);

          var onError = curry([rid, platform, verb], sendError);
          var onMessage = curry([rid, platform, verb], sendMessage);
          var responseHandler = initResponseHandler(onError, onMessage);

          if (report.errors.length === 0) {  // incoming json validated
            o.sessionId = ""+sessionId; // add sessionId to
            sendConfirm(rid); // confirm request is valid and will be processed
            if (typeof proto.platforms[platform].verbs[verb].func === 'function') {
              proto.platforms[platform].verbs[verb].func(o, session, responseHandler);
            } else {
              var client = _this.redis.createClient();
              var channel = 'sockethub:'+_this.sockethubId+':listener:' + platform + ':incoming';
              console.info(' [dispatcher:'+sessionId+'] sending verb "' + verb +
                            '" to channel ' + channel);
              var json_o = JSON.stringify(o);
              client.lpush(channel, json_o);
            }
          } else {  // errors validating incoming json
            onError('unable to validate json against schema');
            console.error(' [dispatcher:'+sessionId+'] JSV validation error: '+JSON.stringify(report.errors));
          }
        }

      } else if (message.type === 'binary') {
        // we don't do anything with this at the moment
        console.info(' ['+protoName+'] received binary message of ' +
                      message.binaryData.length + ' bytes');
        connection.sendBytes(message.binaryData);
      }
    });
  });

  var sendConfirm = function (rid) {
    console.debug(' [dispatcher:'+sessionId+'] sending confirmation receipt');
    connection.sendUTF(JSON.stringify({
      rid: rid,
      verb: 'confirm',
      status: true
    }));
  };


  var initResponseHandler = function (errFunc, msgFunc) {
    return function(err, data) {
      if (err) {
        errFunc(err);
      } else {
        msgFunc(data);
      }
    };
  };

  var sendMessage = function (rid, platform, verb, data) {
    var message = JSON.stringify({
      rid: rid,
      verb: verb,
      platform: platform,
      status: true,
      response: data
    });
    console.debug(' [dispatcher:'+sessionId+'] sending message: ', message);
    connection.sendUTF(message);
  };

  var sendError = function (rid, platform, verb, msg, data) {
    errorSent = true;
    var prep = ' [dispatcher:'+sessionId+'] ERROR [rid:'+rid+',platform:'+platform+',verb:'+verb+'] ';
    prep = prep + msg;

    if (!data) {
      console.debug(prep);
    } else {
      prep = prep +': ';
      console.debug(prep + JSON.stringify(data));
    }
    var response = JSON.stringify({
      rid: rid,
      platform: platform,
      verb: verb,
      status: false,
      message: msg,
      data: data
    });
    console.error(' [dispatcher:'+sessionId+'] response: ',response);
    connection.sendUTF(response);
  };

};

module.exports = Dispatcher;
