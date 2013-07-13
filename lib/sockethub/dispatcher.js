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
  util: require('./util.js'),
  promising : require('promising'),
  Session: require('./session'),
  platforms : { remote : {}, local : {}},
  readyState : undefined,
  errorSent : false,
  sessionIdCounter : 0,
  inShutdown: false,
  sockethubId: '',
  proto: undefined
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
Dispatcher.init = function (myPlatforms, sockethubId, proto) {
  // when we get a new connection, and the protocol specified is matched to the
  // list in the config, then this dispatcher is called.
  //
  // first we do basic checking on the protocol.js file to ensure that it's
  // passes basic checks and has the right base-properties.
  this.sockethubId = sockethubId;
  this.proto = proto;
  this.myPlatforms = myPlatforms; // platforms this dispatcher is responsible for
  var textPossible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  var encText = textPossible.charAt(Math.floor(Math.random() * textPossible.length));
  var randa = Math.floor((Math.random()*10)+1) + new Date().getTime();
  var randb = Math.floor((Math.random()*10)+2) *
              Math.floor((Math.random()*10)+3) /
              Math.floor((Math.random()*10)+4);
  var rand = randa * randb / 1000;
  var encKey = encText + '' + (rand * sockethubId);
  this.session = this.Session('dispatcher', sockethubId, encKey);
  var _this = this;

  // verify all verbs specified in the platforms area are accounted for in the verbs section
  this.session.subsystem.events.on('ping-response', function (data) {
    var now = new Date().getTime();
    console.debug(' [dispatcher] received ping-response from '+data.actor.platform);
    _this.proto.platforms[data.actor.platform].remote.ping.last_received = now;
  });
  this.session.subsystem.events.on('ping', function (data, callback) {
    var now = new Date().getTime();
    console.debug(' [dispatcher] received ping from '+data.actor.platform);
    _this.proto.platforms[data.actor.platform].remote.ping.last_received = now;
  });

  for (var i = 0, num = myPlatforms.length; i < num; i = i + 1) {
    var key = myPlatforms[i];
    if (typeof this.proto.platforms[key] === 'undefined') {
      console.error(' [dispatcher] platform ' + key + ' not found in protocol.js schema, skipping');
      continue;
    } else if ((typeof this.proto.platforms[key].local === 'boolean') &&
        (this.proto.platforms[key].local)) {
      // don't try to ping local platforms, like the dispatcher itself.
      continue;
    }
    var now = new Date().getTime();
    this.proto.platforms[key]['remote'] = {
      'ping' : {
        'last_sent' : now,
        'last_received' : 0
      }
    };
  }

  // ping the platform listeners to see if they're active
  this.session.subsystem.send('ping', {timestamp: new Date().getTime(), encKey: encKey});

  // only return from init() after the ping responses have been completed
  var promise = this.promising();
  // check for ping responses
  var checkCount = 0;
  function result(showedWarning) {
    if (showedWarning) {
      console.error(' [dispatcher] some platforms may not have initialized properly, did not respond to ping.');
      console.error(' [dispatcher] sockethub MAY NOT function correctly.');
      promise.reject('some platforms may not have initialized properly, did not respond to ping.');
    } else {
      console.info(' [dispatcher] sockethub platforms have initialized, all systems go.');
      promise.fulfill();
    }
  }
  setTimeout(function establishCommunication() {
    var showedWarning = false;
    checkCount = checkCount + 1;
    for (var key in _this.proto.platforms) {
      if (!_this.proto.platforms[key].remote) {
        continue;
      }
      if (_this.proto.platforms[key].remote.ping.last_received <
                _this.proto.platforms[key].remote.ping.last_sent) {
        showedWarning = true;
        console.warn(' [dispatcher] WARNING: ' + key + ' platform not responding');
        _this.session.subsystem.send('ping', {timestamp: new Date().getTime(), encKey: encKey});
      }
    }

    if ((checkCount < 9993) && (showedWarning)) {
      setTimeout(establishCommunication, 1000);
    } else {
      result(showedWarning);
    }
  }, 2000);
  return promise;
};


Dispatcher.subscribeOutgoing = function (sessionId, callback) {
  var channel = 'sockethub:' + this.sockethubId + ':dispatcher:outgoing:' + sessionId;

  var _this = this;
  function getNext() {
    _this.util.redis.get('brpop', channel, function (err, incoming) {
      if (err) {
        console.error(" [dispatcher:"+sessionId+"] channel ("+channel+") error: " + err);
      } else {
        console.debug(' [dispatcher:'+sessionId+'] channel ('+channel+') ', incoming[1]);
        callback(incoming[1]);
        getNext();
      }
    });
  }

  getNext();

  console.debug(' [dispatcher:'+sessionId+'] subscribed to channel ' + channel);

  return function() {
  };
};


Dispatcher.shutdown = function () {
  var promise = this.promising();
  this.session.subsystem.cleanup();
  promise.fulfill();
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

  Dispatcher.subscribeOutgoing(sessionId, function (msg) {
    //console.info(' [dispatcher] callback: ', msg);
    connection.sendUTF(msg);
  });

  var pendingMessages = [];

  function queueMessage(message) {
    pendingMessages.push(message);
  }

  connection.on('message', queueMessage);

  Dispatcher.session.get(sessionId).then(function (session) {
    console.debug(' [dispatcher] initializing connection handlers');
    connection.on("close", function() {
      try {
        session.getPlatforms().forEach(function(platform) {
          Dispatcher.sendSubSystem(platform, 'cleanup', {sids: [sessionId]});
        });
        setTimeout(function () {
          Dispatcher.session.destroy(sessionId);
          session = undefined;
        }, 5000);

      } catch(e) {
        console.error(' [dispatcher] failed session cleanup, session already undefined');
      }

    });

    connection.removeListener('message', queueMessage);

    connection.on("message", function (message) {
      errorSent = false;
      //console.debug(" [dispatcher] connection.on('message', ..) fired ", message);
      //console.debug(' [dispacher] shutdown:'+Dispatcher.inShutdown);
      if (Dispatcher.inShutdown) {
        // shutdown in progress
        console.debug(' [dispatcher:' + sessionId + '] shutdown in progress,' +
                      ' cannot receive new messages');

      } else if (message.type === 'utf8') {
        // incoming message to handle
        console.info(' [dispatcher:' + sessionId + '] received message');

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
          } else if (typeof _this.proto.platforms[platform] !== 'object') {
            sendError(rid, platform, 'confirm', 'unknown platform received: ' + platform);
          } else if (typeof _this.proto.platforms[platform].verbs[verb] !== 'object') {
            sendError(rid, platform, 'confirm', 'unknown verb received: ' + verb);
          } else if (typeof m[i].sessionId !== 'undefined') {
            sendError(rid, platform, 'confirm', 'cannot use name sessionId, reserved property');
          } else if ((!session.isRegistered()) && (o.verb !== 'register')) {
            sendError(rid, platform, 'confirm', 'session not registered, cannot process verb');
          }

          if (errorSent) { return false; }

          var jsv = _this.JSVlib.createEnvironment();
          var report = jsv.validate(o, _this.proto.verbs[verb].schema);

          var onError = curry([rid, platform, verb], sendError);
          var onMessage = curry([rid, platform, verb], sendMessage);
          var responseHandler = initResponseHandler(onError, onMessage);

          if (report.errors.length === 0) {  // incoming json validated
            o.sessionId = ""+sessionId; // add sessionId to
            sendConfirm(rid); // confirm request is valid and will be processed
            if (typeof _this.proto.platforms[platform].verbs[verb].func === 'function') {
              _this.proto.platforms[platform].verbs[verb].func(o, session, responseHandler);
            } else {
              var channel = 'sockethub:'+_this.sockethubId+':listener:' + platform + ':incoming';
              console.info(' [dispatcher:'+sessionId+'] sending verb "' + verb +
                            '" to channel ' + channel);
              var json_o = JSON.stringify(o);
              _this.util.redis.set('lpush', channel, json_o);
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

    // fake a "message" event for each message that was received
    // before the session had been fetched:
    var message;
    while(message = pendingMessages.shift()) {
      connection.emit('message', message);
    }
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
      object: data
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
      object: data
    });
    //console.log('response:' + response);
    //console.error(' [dispatcher:'+sessionId+'] response: ',response);
    connection.sendUTF(response);
  };

};

module.exports = Dispatcher;
