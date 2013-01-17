var Dispatcher = {
  JSVlib : require('JSV').JSV, // json schema validator
  redis : require('redis'),
  promising: require('promising'),
  platforms : {},
  readyState : undefined,
  errorSent : false
};

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
  setTimeout(function() {
    var client2 = _this.redis.createClient();
    for (var key in proto.platforms) {
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

  setTimeout(function() {
    var showedWarning = false;
    for (var key in proto.platforms) {
      if (_this.platforms[key]['ping']['last_received'] < _this.platforms[key]['ping']['last_sent']) {
        console.log(' [dispatcher] WARNING: '+key+' platform not responding');
      }
    }

    if (showedWarning) {
      console.log(' [dispatcher] some platforms may not have initialized properly, please check the logs.');
      _this.readyState = false;
    } else {
      console.log(' [dispatcher] sockethub platforms have initialized, all systems go.');
      _this.readyState = true;
    }
  }, 3000);
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
      _this.platforms[data.actor.platform]['ping']['last_received'] = now;
    }
  });
  console.log(' [dispatcher] subscribing to dispatcher:subsystem');
  client1.subscribe('dispatcher:subsystem');
};

Dispatcher.connect = function(connection) {
  // now we set up the dispatcher for incomming messages. the dispatcher verifies the
  // verb exists in the protocol and validates it against the schema.
  // if sucessful, it passes it on to the protocols defined function for handling
  // that verb.
  var curry = require('curry');
  this.connection = connection;

  var _this = this;
  connection.on("message", function (message) {
    if (message.type === 'utf8') {
      console.log(' [dispatcher] received message: ' + message.utf8Data);

      var obj = false;
      try {
        obj = JSON.parse(message.utf8Data);
      } catch (e) {
        console.log(' [dispatcher] invalid JSON!');
      }

      var onError;
      var m = []; // list of incomming requests
      if (typeof obj[0] === 'object') { // list of requests
        m = obj;
      } else { // single request
        m[0] = obj;
      }

      for (var i = 0, numObjs = m.length; i < numObjs; i = i + 1) {
        var rid = m[i].rid, platform = m[i].platform, verb = m[i].verb;
        if (typeof rid !== 'string') {
          sendError(undefined, undefined, undefined, 'no rid (request ID) specified');
        } else if (typeof platform !== 'string') {
          sendError(m[i]['rid'], undefined, undefined, 'no platform (protocol) specified');
        } else if (typeof verb !== 'string') {
          sendError(rid, platform, undefined, 'no verb (action) specified');
        } else if (typeof proto.platforms[platform] !== 'object') {
          sendError(rid, platform, verb, 'unknown platform receivied: '+platform);
        } else if (typeof proto.platforms[platform].verbs[verb] !== 'object') {
          sendError(rid, platform, verb, 'unknown verb receivied: '+verb);
        }
        if (this.errorSent) { return false; }

        var jsv = _this.JSVlib.createEnvironment();
        report = jsv.validate(m[i], proto.platforms[platform].verbs[verb].schema);
        onError = curry([rid, platform, verb], sendError);
        if (report.errors.length === 0) {  // incoming json validated
          if (typeof proto.platforms[platform].verbs[verb].func === 'function') {
            var promise = Dispatcher.promising();
            proto.platforms[platform].verbs[verb].func(promise, m[i]);
            promise.then(onComplete, onError);
          } else {
            var client = _this.redis.createClient();
            var channel = 'listener:'+platform+':incoming';
            console.log(' [dispatcher] sending verb "' + verb +
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
    this.connection.sendUTF(response);
  };

  var sendError = function(rid, platform, verb, msg, data) {
    this.errorSent = true;
    if (verb) {
      prep = ' [dispatcher:'+rid+'] error with verb "'+verb+'": ';
    } else {
      prep = ' [dispatcher:'+rid+'] ';
    }
    prep = prep + msg;

    if (!data) {
      console.log(prep);
    } else {
      prep = prep +': ';
      console.log(prep + JSON.stringify(data));
    }
    this.connection.sendUTF(JSON.stringify({
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