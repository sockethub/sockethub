var Handler = {};
Handler.init = function (protoName, connection) {
  try {
    proto = require("./" + protoName + "/protocol.js");
  } catch (e) {
    throw 'unable to load lib/protocols/' + protoName + "/protocol.js " + e;
  }

  if ((typeof proto !== 'object') || (typeof proto.commands !== 'object')) {
    throw 'invalid format in lib/protocols/' + protoName + "/protocol.js ";
  }

  for (var i = 0, len = proto.commands.length; i < len; i = i + 1) {
    if (typeof proto.commands[i].name !== "string") {
      throw 'invalid format in lib/protocols/' + protoName + "/protocol.js\n'name' property must exist and be of type 'string'";
    }
    if (typeof proto.commands[i].schema !== 'object') {
      throw 'invalid format in lib/protocols/' + protoName + "/protocol.js\n'schema' property must exist and be of type 'object'";
    }
    if (typeof proto.commands[i].func !== 'function') {
      throw 'invalid format in lib/protocols/' + protoName + "/protocol.js\n'func' property must exist and be of type 'function'";
    }
  }

  var JSV = require('JSV').JSV;
  var env = JSV.createEnvironment();
  var curry = require('curry');

  connection.on("message", function (message) {
    if (message.type === 'utf8') {
      console.log(' ['+protoName+'] received message: ' + message.utf8Data);

      var msg = false;
      try {
        msg = JSON.parse(message.utf8Data);
      } catch (e) {
        console.log(' [ws] invalid JSON!');
      }

      var report;
      var onError;
      for (var key in msg) {
        for (i = 0, len = proto.commands.length; i < len; i = i + 1) {
          if (proto.commands[i].name === key) {
            report = env.validate(msg[key], proto.commands[i].schema);
            onError = curry([key], sendError);
            if (report.errors.length === 0) {  // incoming json validated
              proto.commands[i].func(msg[key], onComplete, onError);
            } else {  // errors validating incoming json
              onError('error in json data received', report.errors);
            }
          }
        }
      }

    } else if (message.type === 'binary') {
      console.log(' ['+protoName+'] received binary message of ' +
                    message.binaryData.length + ' bytes');
      connection.sendBytes(message.binaryData);
    }

  });

  var onComplete = function(response) {
    console.log(' ['+protoName+'] sending response: ' + response);
    connection.sendUTF(response);
  };

  var sendError = function(command, msg, data) {
    console.log(' ['+protoName+'] error with command "'+command+'": ' + msg + ':', data );
    connection.sendUTF('{"'+command+'":{"status": false, "data":"'+data+'"}}');
  };
};
module.exports = Handler;