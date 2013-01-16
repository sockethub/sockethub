module.exports = (function() {
  var pub = {};
  var _ = {};
  var JSVlib = require('JSV').JSV; // json schema validator
  var jsv = JSVlib.createEnvironment();

  pub.init = function (protoName, connection) {
    _.protoName = protoName;
    _.connection = connection;
    var report;

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
    try {
      protoSchema = require("./schema.js");
    } catch (e) {
      throw 'unable to load lib/protocols/schema.js ' + e;
    }

    // TODO: FIXME: XXX: - this needs to be looked into, always passes
    report = jsv.validate(proto, protoSchema);
    if (report.errors.length !== 0) {  // protocol.js json errors
      throw 'invalid format in lib/protocols/schema.js : '+ JSON.stringify(report.errors);
    } else {
      console.log(' [handler] lib/protocols/'+protoName+'/protocols.js schema validated');
    }



    // now we set up the dispatcher for incomming messages. the dispatcher verifies the
    // verb exists in the protocol and validates it against the schema.
    // if sucessful, it passes it on to the protocols defined function for handling
    // that verb.
    //

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

        var onError;

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
              if (typeof proto.platforms[m[i]['platform']].verbs[m[i]['verb']].func === 'function') {
                proto.platforms[m[i]['platform']].verbs[m[i]['verb']].func(m[i], onComplete, onError);
              } else {
                console.log(' ... should be sending verb "'+m[i]['verb']+'" to redis queue for platorm "'+m[i]['platform']+'"');
              }
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
  return pub;
}());

