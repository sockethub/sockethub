var Dispatcher = {};
  var _ = {};
  Dispatcher.init = function (protoName, connection) {
    _.protoName = protoName;
    _.connection = connection;
    // when we get a new connection, and the protocol specified is matched to the
    // list in the config, then this dispatcher is called.
    //
    // first we do basic checking on the protocol.js file to ensure that it's
    // passes basic checks and has the right base-properties.
    try {
      proto = require("./" + protoName + "/protocol.js");
    } catch (e) {
      throw 'unable to load lib/protocols/' + protoName + "/protocol.js " + e;
    }

    if ((typeof proto !== 'object') || (typeof proto.platforms !== 'object')) {
      throw 'invalid format in lib/protocols/' + protoName + "/protocol.js ";
    }

    /*
    for (var i = 0, len = proto.platforms.length; i < len; i = i + 1) {
      if (typeof proto.verb[i].name !== "string") {
        throw 'invalid format in lib/protocols/' + protoName +
              "/protocol.js\n'name' property must exist and be of type 'string'";
      }
      if (typeof proto.verb[i].schema !== 'object') {
        throw 'invalid format in lib/protocols/' + protoName +
              "/protocol.js\n'schema' property must exist and be of type 'object'";
      }
      if (typeof proto.verb[i].func !== 'function') {
        throw 'invalid format in lib/protocols/' + protoName +
              "/protocol.js\n'func' property must exist and be of type 'function'";
      }
    }
    */


    // now we set up the dispatcher for incomming messages. the dispatcher verifies the
    // verb exists in the protocol and validates it against the schema.
    // if sucessful, it passes it on to the protocols defined function for handling
    // that verb.
    //
    var JSVlib = require('JSV').JSV; // json schema validator
    var jsv = JSVlib.createEnvironment();
    var curry = require('curry');

    connection.on("message", function (message) {
      if (message.type === 'utf8') {
        console.log(' ['+protoName+'] received message: ' + message.utf8Data);

        var obj = false;
        try {
          obj = JSON.parse(message.utf8Data);
        } catch (e) {
          console.log(' [ws] invalid JSON!');
        }

        var report, onError;

        var m = []; // list of incomming requests
        if (typeof obj[0] === 'object') { // list of requests
          m = obj;
        } else { // single request
          m[0] = obj;
        }

        for (var i = 0, numObjs = m.length; i < numObjs; i = i + 1) {
          if (typeof m[i]['rid'] !== 'string') {
            sendError(undefined, undefined, 'no rid (request ID) specified');
            return false;
          } else if (typeof m[i]['platform'] !== 'string') {
            sendError(m[i]['platform'], undefined, 'no platform (protocol) specified');
            return false;
          } else if (typeof m[i]['verb'] !== 'string') {
            sendError(m[i]['rid'], undefined, 'no verb (action) specified');
            return false;
          }

          if (typeof proto.platforms[m[i]['platform']].verbs[m[i]['verb']] === 'object') {
            var key = m[i]['verb'];
            report = jsv.validate(m[key], proto.platforms[m[i]['platform']].verbs[m[i]['verb']].schema);
            onError = curry([m[i]['rid'], key], sendError);
            if (report.errors.length === 0) {  // incoming json validated
              proto.platforms[m[i]['platform']].verbs[m[i]['verb']].func(m[i], onComplete, onError);
            } else {  // errors validating incoming json
              onError('error in json data received', report.errors);
            }
          } else {
            sendError(m[i]['rid'], m[i]['verb'], 'unknown verb receivied: '+m[i]['verb']);
          }
        }

      } else if (message.type === 'binary') {
        console.log(' ['+protoName+'] received binary message of ' +
                      message.binaryData.length + ' bytes');
        connection.sendBytes(message.binaryData);
      }

    });

  };

  var onComplete = function(response) {
    console.log(' ['+_.protoName+'] sending response: ' + response);
    _.connection.sendUTF(response);
  };

  var sendError = function(rid, verb, msg, data) {
    if (verb) {
      prep = ' ['+_.protoName+':'+rid+'] error with verb "'+verb+'": ';
    } else {
      prep = ' [dispatcher:'+rid+'] ';
    }
    prep = prep + msg;

    if (!data) {
      json_data = '{}';
      console.log(prep);
    } else {
      prep = prep +': ';
      json_data = JSON.stringify(data);
      console.log(prep + json_data);
    }
    _.connection.sendUTF('{"rid": "'+rid+'", "verb": "'+verb+'", "status": false, "message": "'+msg+'", "data":"'+json_data+'"}');
  };

module.exports = Dispatcher;