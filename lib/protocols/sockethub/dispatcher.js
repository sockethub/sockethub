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
  Session: require('./session'),
  platforms : { remote : {}, local : {}},
  readyState : undefined,
  errorSent : false,
  sessionIdCounter : 0
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
Dispatcher.init = function () {
  // when we get a new connection, and the protocol specified is matched to the
  // list in the config, then this dispatcher is called.
  //
  // first we do basic checking on the protocol.js file to ensure that it's
  // passes basic checks and has the right base-properties.
  try {
    proto = require("./protocol.js");
  } catch (e) {
    throw 'unable to load sockethub/protocol.js ' + e;
  }
  try {
    protoSchema = require("./schema_protocol.js");
  } catch (e) {
    throw 'unable to load lib/protocols/sockethub/schema_protocol.js ' + e;
  }

  // validate that the protocol.js has the correct schema for defining all verbs
  // and platforms with their associated verbs.
  var jsv = this.JSVlib.createEnvironment();
  var report = jsv.validate(proto, protoSchema);
  if (report.errors.length !== 0) {  // protocol.js json errors
    throw 'invalid format in lib/protocols/sockethub/schema_protocol.js : '+
          JSON.stringify(report.errors);
  } else {
    console.log(' [dispatcher] lib/protocols/sockethub/protocol.js schema validated');
  }

  // ping the platform listeners to see if their active yet
  this.subscribeSubSystemChannel();

  var _this = this;
  // send pings to platforms
  setTimeout(function() {
    var client2 = _this.redis.createClient();
    for (var key in proto.platforms) {
      if ((typeof proto.platforms[key].local === 'boolean') &&
          (proto.platforms[key].local)) {
        // don't try to ping local platforms, like the dispatcher itself.
        continue;
      }
      var channel = 'listener:'+key+':subsystem';
      console.log(' [dispatcher] pinging '+channel);
      var now = new Date().getTime();
      _this.platforms[key] = {
        'ping' : {
          'last_sent' : now,
          'last_received' : 0
        }
      };
      client2.publish(channel, JSON.stringify({
        verb: 'ping',
        actor: {
          channel: 'dispatcher:subsystem',
          object: {
            timestamp: now
          }
        }
      }));
    }
    console.log(' [dispatcher] finished sending pings');
  }, 0);

  var promise = this.promising();

  // check for ping responses
  setTimeout(function() {
    var showedWarning = false;
    for (var key in proto.platforms.remote) {
      if (_this.platforms[key]['ping']['last_received'] < _this.platforms[key]['ping']['last_sent']) {
        showedWarning = true;
        console.log(' [dispatcher] WARNING: ' + key + ' platform not responding');
      }
    }

    if (showedWarning) {
      console.log(' [dispatcher] some platforms may not have initialized properly, please check the logs.');
      promise.reject('some platforms may not have initialized properly, please check the logs.');
    } else {
      console.log(' [dispatcher] sockethub platforms have initialized, all systems go.');
      promise.fulfill();
    }
  }, 1000);

  return promise;
};

// listens for activity on the dispatcher:subsystem channel, and adds ping data
// a dict of platforms.
Dispatcher.subscribeSubSystemChannel = function () {
  var client1 = this.redis.createClient();
  var _this = this;
  client1.on('message', function (channel, ss_msg) {
    console.log(' [dispatcher] received message on ' + channel + ' channel - ' + ss_msg);
    var data = JSON.parse(ss_msg);
    if (data.verb === 'ping') {
      var now = new Date().getTime();
      _this.platforms['remote'][data.actor.platform]['ping']['last_received'] = now;
    }
  });
  console.log(' [dispatcher] subscribing to dispatcher:subsystem');
  client1.subscribe('dispatcher:subsystem');
};

Dispatcher.subscribeOutgoing = function (sessionId, callback) {
  var channel = 'dispatcher:outgoing:' + sessionId;
  var client;

  function getNext() {
    client = Dispatcher.redis.createClient();
    client.blpop(channel, 0, function(err, msg) {
      if(err) {
        console.error("BLPOP ERRORED: ", err);
      } else {
        console.log(' [dispatcher] received message on ' + channel + ' channel - ' + msg);
        callback(msg);
        client.quit();
        getNext();
      }
    });
  }

  getNext();

  console.log(' [dispatcher] "subscribed" to channel ' + channel);

  return function() {
    if(client) {
      client.quit();
    }
  };
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

  var sessionId = ++this.sessionIdCounter;
  var session = Dispatcher.Session.get(sessionId);

  var _this = this;

  var cleanupOutgoing = Dispatcher.subscribeOutgoing(sessionId, function(msg) {
    console.log(' [dispatcher]: received callback from queue, sending message:' + msg);
    connection.sendUTF(msg);
  });

  connection.on("close", function() {
    var client = _this.redis.createClient();
    session.getPlatforms().forEach(function(platform) {
      client.rpush('listener:' + platform + ':cleanup', sessionId);
    });
    Dispatcher.Session.destroy(sessionId);
    cleanupOutgoing();
    session = undefined;
  });

  connection.on("message", function (message) {
    var errorSent = false;
    if (message.type === 'utf8') {
      console.log(' [dispatcher] received message: ' + message.utf8Data);

      var obj = false;
      try {
        obj = JSON.parse(message.utf8Data);
      } catch (e) {
        console.log(' [dispatcher] invalid JSON!');
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

        var rid = m[i].rid, platform = m[i].platform, verb = m[i].verb;

        if ((typeof rid !== 'string') &&
           (typeof rid !== 'number')) {
          sendError(undefined, undefined, 'confirm', 'no rid (request ID) specified');
        } else if (typeof platform !== 'string') {
          sendError(rid, undefined, 'confirm', 'no platform specified');
        } else if (typeof verb !== 'string') {
          sendError(rid, platform, 'confirm', 'no verb (action) specified');
        } else if (typeof proto.platforms[platform] !== 'object') {
          sendError(rid, platform, 'confirm', 'unknown platform receivied: ' + platform);
        } else if (typeof proto.platforms[platform].verbs[verb] !== 'object') {
          sendError(rid, platform, 'confirm', 'unknown verb receivied: ' + verb);
        } else if (typeof m[i].sessionId !== 'undefined') {
          sendError(rid, platform, 'confirm', 'cannot use name sessionId, reserved property.');
        }
        if (errorSent) { return false; }

        var o = m[i];
        var jsv = _this.JSVlib.createEnvironment();

        session.addPlatform(platform);

        report = jsv.validate(m[i], proto.platforms[platform].verbs[verb].schema);
        var onError = curry([rid, platform, verb], sendError);
        var onMessage = curry([rid, platform, verb], sendMessage);
        var messageHandler = initMessageHandler(onError, onMessage);
        if (report.errors.length === 0) {  // incoming json validated
          m[i].sessionId = sessionId; // add sessionId to
          sendConfirm(rid); // confirm request is valid and will be processed
          if (typeof proto.platforms[platform].verbs[verb].func === 'function') {
            proto.platforms[platform].verbs[verb].func(m[i], session, messageHandler);
          } else {
            var client = _this.redis.createClient();
            var channel = 'listener:' + platform + ':incoming';
            console.log(' [dispatcher] sending verb "' + verb +
                          '" to channel ' + channel);
            client.rpush(channel, JSON.stringify(m[i]));
          }
        } else {  // errors validating incoming json
          onError('error in json data received : '+JSON.stringify(report.errors));
        }
      }

    } else if (message.type === 'binary') {
      console.log(' ['+protoName+'] received binary message of ' +
                    message.binaryData.length + ' bytes');
      connection.sendBytes(message.binaryData);
    }

  });

  var sendConfirm = function (rid) {
    console.log(' [dispatcher] sending confirmation receipt');
    connection.sendUTF(JSON.stringify({
      rid: rid,
      verb: 'confirm',
      status: true
    }));
  };


  var initMessageHandler = function (errFunc, msgFunc) {
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
    console.log(' [dispatcher] sending message: ' + message);
    connection.sendUTF(message);
  };

  var sendError = function (rid, platform, verb, msg, data) {
    errorSent = true;
    var prep = ' [dispatcher] ERROR [rid:'+rid+',platform:'+platform+',verb:'+verb+'] ';
    //if (verb) {
    //  prep = 'error with verb '+verb+': ';
    //}
    prep = prep + msg;

    if (!data) {
      console.log(prep);
    } else {
      prep = prep +': ';
      console.log(prep + JSON.stringify(data));
    }
    var response = JSON.stringify({
      rid: rid,
      platform: platform,
      verb: verb,
      status: false,
      message: msg,
      data: data
    });
    //console.log(' [dispatcher] response: ',response);
    connection.sendUTF(response);
  };

};

module.exports = Dispatcher;
