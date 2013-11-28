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

var JSVlib = require('JSV').JSV; // json schema validator
var Q = require('q');
var util = require('./util.js');
var SessionManager = require('./session.js');
var config = require('./config-loader.js').get();

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
  platforms : { remote : {}, local : {}},
  readyState : undefined,
  errorSent : false,
  sessionIdCounter : 0,
  inShutdown: false,
  sockethubId: '',
  proto: undefined,
  myPlatforms: undefined
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
  var encKey;
  if (typeof sockethubId === 'number') {
    encKey = encText + '' + (rand * sockethubId);
  } else {
    encKey = encText + '' + rand + sockethubId;
  }

  this.sessionManager = SessionManager({platform: 'dispatcher', sockethubId: sockethubId, encKey: encKey});
  var _this = this;

  function pingHandler(data) {
    var now = new Date().getTime();
    try {
      console.debug(' [dispatcher] received ping-response from '+data.actor.platform);
      _this.proto.platforms[data.actor.platform].remote.ping.last_received = now;
    } catch (e) {
      // no problem
      console.info(' [dispatcher] recevied ping response from external platform '+data.actor.platform);
    }
  }
  // verify all verbs specified in the platforms area are accounted for in the verbs section
  this.sessionManager.subsystem.events.on('ping-response', pingHandler);

  this.sessionManager.subsystem.events.on('ping', pingHandler);

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
    this.proto.platforms[key].remote = {
      'ping' : {
        'last_sent' : now,
        'last_received' : 0
      }
    };
  }

  // ping the platform listeners on the designated subsystem channel to see if
  // they're active
  this.sessionManager.subsystem.send('ping', {timestamp: new Date().getTime(), encKey: encKey});

  // only return from init() after the ping responses have been completed
  var q = Q.defer();
  // check for ping responses
  var checkCount = 0;
  function result(showedWarning) {
    if (showedWarning) {
      console.error(' [dispatcher] some platforms may not have initialized properly, did not respond to ping');
      console.error(' [dispatcher] sockethub MAY NOT function correctly');
      q.reject('some platforms may not have initialized properly, did not respond to ping');
    } else {
      console.info(' [dispatcher] sockethub platforms have responded');
      console.info(' [dispatcher] initialization complete');
      q.resolve();
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
        console.warn(' [dispatcher] WARNING: local ' + key + ' platform not responding. attempt: '+checkCount);
        _this.sessionManager.subsystem.send('ping', {timestamp: new Date().getTime(), encKey: encKey});
      }
    }

    if ((checkCount < 4) && (showedWarning)) {
      setTimeout(establishCommunication, 1000);
    } else {
      result(showedWarning);
    }
  }, 1000);
  return q.promise;
};


Dispatcher.subscribeOutgoing = function (sessionId, callback) {
  var channel = 'sockethub:' + this.sockethubId + ':dispatcher:outgoing:' + sessionId;

  function getNext() {
    util.redis.get('brpop', channel, function (err, incoming) {
      if (err) {
        console.error(" [dispatcher:" + sessionId + "] chan. " + channel + " error: " + err);
      } else {
        console.debug(' [dispatcher:' + sessionId + '] chan. ' + channel );//, incoming[1]);

        if (incoming[1] === '{"platform":"dispatcher","verb":"disconnect","status":true}') {
          // received shutdown message from self
          // don't renew brpop request
          console.info(' [dispatcher] disconnecting from redis channel '+ channel);
        } else {
          //console.debug(' [dispatcher] sending message and jumping back on redis queue');
          callback(incoming[1]);
          getNext();
        }
      }
    });
  }

  getNext();

  console.debug(' [dispatcher:'+sessionId+'] subscribed to channel ' + channel);

  return function() {
  };
};


Dispatcher.shutdown = function () {
  console.debug(' [dispatcher] shutting down...');
  this.sessionManager.subsystem.cleanup();
  console.info(' [dispatcher] shutdown complete');
};


// Dispatcher.disconnect = function () {
//   console.log('Dispatcher.disconnect - sessionId: '+this.sessionId);
//   var disconnect = {
//     platform: 'dispatcher',
//     verb: 'disconnect',
//     status: true
//   };
//   this.sessionManager.get(this.sessionId, false).then(function (session) {
//     session.send(disconnect);
//   }, function () {
//     console.log(' [dispatcher] received disconnect for invalid sesstion ' + this.sessionId);
//   });
// };

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
Dispatcher.connect = function (connection) {
  // now we set up the dispatcher for incoming messages. the dispatcher verifies the
  // verb exists in the protocol and validates it against the schema.
  // if sucessful, it passes it on to the protocols defined function for handling
  // that verb.
  var curry = require('curry');
  this.sessionIdCount = this.sessionIdCount + 1;
  var sessionId = new Date().getTime() + this.sessionIdCounter;
  this.sessionId = sessionId;
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

  Dispatcher.sessionManager.get(sessionId).then(function (session) {
    console.debug(' [dispatcher] initializing connection handlers');

    connection.on("close", function() {
      try {
        Dispatcher.sessionManager.subsystem.send('cleanup', { sids: [ sessionId ] });
        setTimeout(function () {
          Dispatcher.sessionManager.destroy(sessionId).then(function () {
            //session = undefined;
          });
        }, 5000);

      } catch(e) {
        console.error(' [dispatcher] failed session cleanup '+e);
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
        //console.info(' [dispatcher:' + sessionId + '] received message');

        var obj = false;
        try {
          obj = JSON.parse(message.utf8Data);
        } catch (e) {
          console.error(' [dispatcher:' + sessionId + '] invalid JSON! ', obj);
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

          var rid = m[i].rid,
              platform = m[i].platform,
              verb = m[i].verb,
              o = m[i];

          if ((typeof rid !== 'string') &&
             (typeof rid !== 'number')) {
            sendError(undefined, undefined, 'confirm', 'no rid (request ID) specified');
          } else if (typeof platform !== 'string') {
            sendError(rid, undefined, 'confirm', 'no platform specified');
          } else if (typeof verb !== 'string') {
            sendError(rid, platform, 'confirm', 'no verb (action) specified');
          } else if ((typeof _this.proto.platforms[platform] !== 'object') ||
                     ((_this.proto.platforms[platform].remote) &&
                      (_this.proto.platforms[platform].remote.ping) &&
                      (_this.proto.platforms[platform].remote.ping.last_received === 0))) {
            sendError(rid, platform, 'confirm', 'unknown platform received: ' + platform);
          } else if ((platform !== 'dispatcher') &&
                     (config.PLATFORMS.indexOf(platform) < 0)) {
            sendError(rid, platform, 'confirm', "platform '"+ platform + "' not loaded");
          } else if (typeof _this.proto.platforms[platform].verbs[verb] !== 'object') {
            sendError(rid, platform, 'confirm', 'unknown verb received: ' + verb);
          } else if (typeof m[i].sessionId !== 'undefined') {
            sendError(rid, platform, 'confirm', 'cannot use name sessionId, reserved property');
          } else if ((!session.isRegistered()) && (o.verb !== 'register')) {
            sendError(rid, platform, 'confirm', 'session not registered, cannot process verb');
          }

          if (typeof o.target === 'undefined') {
            o.target = [];
          }
          if (typeof o.object === 'undefined') {
            o.object = {};
          }

          if (errorSent) { return false; }
          console.info(' [dispatcher:' + sessionId + '] received message [platform: ' + o.platform + ', verb: ' + o.verb + ']');

          var jsv = JSVlib.createEnvironment();
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
              util.redis.set('rpush', channel, json_o);
            }
          } else {  // errors validating incoming json
            onError('unable to validate json against schema');
            console.error(' [dispatcher:'+sessionId+'] JSV validation error: '+JSON.stringify(report.errors));
          }
        }

      } else if (message.type === 'binary') {
        // we don't do anything with this at the moment
        console.info(' [dispatcher:'+sessionId+'] received binary message of ' +
                      message.binaryData.length + ' bytes');
        connection.sendBytes(message.binaryData);
      }
    });

    // fake a "message" event for each message that was received
    // before the session had been fetched:
    var message;
    while (message = pendingMessages.shift()) {
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


  var disconnect = function () {
    console.log('Dispatcher.disconnect - sessionId: '+sessionId);
    var disconnect = {
      platform: 'dispatcher',
      verb: 'disconnect',
      status: true
    };
    _this.sessionManager.get(sessionId, false).then(function (session) {
      session.send(disconnect);
    }, function () {
      console.log(' [dispatcher] received disconnect for invalid sesstion ' + sessionId);
    });
  };

  return disconnect;
};

module.exports = Dispatcher;
