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
    if ((typeof proto.commands[i].name !== "string") ||
        (typeof proto.commands[i].schema !== 'object') ||
        (typeof proto.commands[i].func !== 'function')) {
      throw 'invalid format in lib/protocols/' + protoName + "/protocol.js ";
    }
  }

  connection.on("message", function (message) {
    if (message.type === 'utf8') {
      console.log(' ['+protoName+'] received message: ' + message.utf8Data);

      var msg = false;
      try {
        msg = JSON.parse(message.utf8Data);
      } catch (e) {
        console.log(' [ws] invalid JSON!');
      }

      for (var key in msg) {
        for (var i = 0, len = proto.commands.length; i < len; i = i + 1) {
          if (proto.commands[i].name === key) {
            proto.commands[i].func(msg[key], onComplete);
          }
        }
      }

/*
      if (msg) {
        response = '{"response": {"date":"'+msg.ping.date+'"}}';
      } else {
        response = '{"response": "invalid json"}';
      }
*/

    } else if (message.type === 'binary') {
      console.log(' ['+protoName+'] received binary message of ' + message.binaryData.length + ' bytes');
      connection.sendBytes(message.binaryData);
    }

  });

  var onComplete = function(response) {
    console.log(' ['+protoName+'] sending response: ' + response);
    connection.sendUTF(response);
  };
};
module.exports = Handler;