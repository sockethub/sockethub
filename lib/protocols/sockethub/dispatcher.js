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
  platforms : { remote : {}, local : {}},
  readyState : undefined,
  errorSent : false
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
  }, 1000);

  var promise = this.promising();

  // check for ping responses
  setTimeout(function() {
    var showedWarning = false;
    for (var key in proto.platforms.remote) {
      if (_this.platforms[key]['ping']['last_received'] < _this.platforms[key]['ping']['last_sent']) {
        showedWarning = true;
        console.log(' [dispatcher] WARNING: '+key+' platform not responding');
      }
    }

    if (showedWarning) {
      console.log(' [dispatcher] some platforms may not have initialized properly, please check the logs.');
      promise.reject('some platforms may not have initialized properly, please check the logs.');
    } else {
      console.log(' [dispatcher] sockethub platforms have initialized, all systems go.');
      promise.fulfill();
    }
  }, 3000);

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
  // now we set up the dispatcher for incomming messages. the dispatcher verifies the
  // verb exists in the protocol and validates it against the schema.
  // if sucessful, it passes it on to the protocols defined function for handling
  // that verb.
  var curry = require('curry');

  var _this = this;
  connection.on("message", function (message) {
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

      var onError;
      var m = []; // list of incomming requests
      if (typeof obj[0] === 'object') { // list of requests
        m = obj;
      } else { // single request
        m[0] = obj;
      }

      for (var i = 0, numObjs = m.length; i < numObjs; i = i + 1) {
        if (typeof m[i]['rid'] !== 'string') {
          sendError(undefined, undefined, undefined, 'no rid (request ID) specified');
        } else if (typeof m[i]['platform'] !== 'string') {
          sendError(m[i]['rid'], undefined, undefined, 'no platform (protocol) specified');
        } else if (typeof m[i]['verb'] !== 'string') {
          sendError(m[i]['rid'], m[i]['platform'], undefined, 'no verb (action) specified');
        } else if (typeof proto.platforms[m[i]['platform']] !== object) {
          sendError(m[i]['rid'], m[i]['platform'], m[i]['verb'], 'unknown platform receivied: '+m[i]['platform']);
        } else if (typeof proto.platforms[m[i]['platform']].verbs[m[i]['verb']] !== 'object') {
          sendError(m[i]['rid'], m[i]['platform'], m[i]['verb'], 'unknown verb receivied: '+m[i]['verb']);
        }
        if (this.errorSent) { return false; }

        var key = m[i]['verb'];
        var jsv = _this.JSVlib.createEnvironment();
        report = jsv.validate(m[key], proto.platforms[m[i]['platform']].verbs[m[i]['verb']].schema);
        onError = curry([m[i]['rid'], m[i]['platform'], key], sendError);
        if (report.errors.length === 0) {  // incoming json validated
          if (typeof proto.platforms[m[i]['platform']].verbs[m[i]['verb']].func === 'function') {
            proto.platforms[m[i]['platform']].verbs[m[i]['verb']].func(m[i], onComplete, onError);
          } else {
            var client = _this.redis.createClient();
            var channel = 'listener:'+m[i]['platform']+':incoming';
            console.log(' [dispatcher] sending verb "' + m[i]['verb'] +
                          '" to channel ' + channel);
            client.rpush(channel, JSON.stringify(m[i]));
            ///console.log(' ... should be sending verb "'+m[i]['verb']+'" to redis queue for platorm "'+m[i]['platform']+'"');
          }
        } else {  // errors validating incoming json
          onError('error in json data received', report.errors);
        }
      }

    } else if (message.type === 'binary') {
      console.log(' ['+protoName+'] received binary message of ' +
                    message.binaryData.length + ' bytes');
      connection.sendBytes(message.binaryData);
    }

  });

  var onComplete = function(response) {
    console.log(' [dispatcher] sending response: ' + response);
    connection.sendUTF(response);
  };

  var sendError = function(rid, platform, verb, msg, data) {
    this.errorSent = true;

    var prep = ' [dispatcher] ERROR [rid:'+rid+',platform:'+platform+',verb:'+verb+'] ';
    if (verb) {
      prep = 'error with verb "'+verb+'": ';
    }
    prep = prep + msg;

    if (!data) {
      console.log(prep);
    } else {
      prep = prep +': ';
      console.log(prep + JSON.stringify(data));
    }
    connection.sendUTF(JSON.stringify({
      rid: rid,
      platform: platform,
      verb: verb,
      status: false,
      message: msg,
      data: data
    }));
  };

};

module.exports = Dispatcher;