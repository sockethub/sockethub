/**
 * Function: WebSocketClient
 *
 * The WebSocketClient object is used to create an object for simplifying
 * WebSocketClient requests.
 *
 *      env.WebSocketClient = new this.WebSocketClient();
 *      env.WebSocketClient.connect('ws://localhost:9992/',
 *                     'echo-protocol',
 *                      function(connection) {
 *           env.connection = connection;
 *           env.connection.send('command', _this);
 *      });
 *
 * Parameters:
 *
 *   baseUrl - the baseUrl of all your WebSocketClient calls
 *
 * Returns:
 *
 *   returns a WebSocketClient object a connect() function, sendAndVerify(),
 *   and sendWithCallback()
 */
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

//FIXME is this a nice way to just ommit websocket support

if(typeof window === 'undefined') { // node
  define(['websocket', 'jaribu/tools/Write'], function (WebSocket, Write, undefined) {
    var writeObj = new Write();
    var write = writeObj.func;
    
    var WebSocketClient = function (cfg) {
      if (typeof cfg.url === 'string') {
        this.url = cfg.url;
      }
      if (typeof cfg.type === 'string') {
        this.type = cfg.type;
      }
    };

    WebSocketClient.prototype = {
      url: undefined,
      type: undefined
    };

    WebSocketClient.prototype.setTest = function (test) {
      this.test = test;
    };

    WebSocketClient.prototype.connect = function (onComplete) {
      var client = new WebSocket.client();
      var self = this;

      client.on('connectFailed', function (error) {
        write('[WebSocketClient]: Connect Error: ' + error.toString());
      });

      client.on('connect', function (connection) {
        write('[WebSocketClient]: connected');
        var cmd = {
          command: '',
          callbacks: {
            onMessage: undefined,
            onError: undefined,
            onComplete: undefined
          },
          autoVerify: false
        }; // ASYNC ?

        connection.on('error', function (error) {
          write("[WebSocketClient]: Connection Error: " + error.toString());
        });

        connection.on('close', function () {
          write('[WebSocketClient]: Connection Closed');
        });

        connection.on('message', function (message) {
          var key;
          if (cmd.autoVerify === true) {
            //console.log('self.test.result:'+self.test.result);

            self.test.assertFailAnd(cmd.expected, undefined, 'sendAndVerify result (second param) undefined');
            var msg = JSON.parse(message.utf8Data);
            //msg = msg.replace(/["]/g,'');

            if (message.type === 'utf8') {
              write("[WebSocketClient]: Received Response: " + message.utf8Data);

              if ((typeof cmd.confirmProps !== 'undefined') &&
                  (!cmd.receivedConfirm)) {
                // confirmation expected, and not received yet. check to see if this is it
                for (key in cmd.confirmProps) {
                  self.test.assertAnd(cmd.confirmProps[key], msg[key], 'checking for property: '+key);
                }
                //console.log('self.test.result(): '+self.test.result());
                if (self.test.result() !== false) {
                  console.log('RECEIVED CONFIRM');
                  cmd.receivedConfirm = true;
                }
                //self.test.result(true);
              } else if ((cmd.expected !== undefined) && ((cmd.receivedConfirm) || (typeof cmd.confirmProps === 'undefined'))) {
                // either confirmation received already, or not expected, continue with
                // check

                //console.log('actual response: ', message.utf8Data);
                var onComplete = false;
                if (cmd.callbacks.onComplete !== undefined) {
                  // if onComplete was called, we dont want this assert to finish
                  // the test if the match is successful, only if theres a failure.
                  // which is why we use assertAnd, instead of just assert.
                  onComplete = true;
                }

                if (typeof cmd.expected === 'string') {
                  // if the command is a string, it's probably json, lets compare it directly in that case
                  if (onComplete) {
                    self.test.assertAnd(cmd.expected, message.utf8Data, 'tried to compare json strings');
                  } else {
                    self.test.assert(cmd.expected, message.utf8Data, 'tried to compare json strings');
                  }
                } else {
                  //console.log('MSG: ', msg);
                  //console.log('RES: ', self.test.result);
                  if (onComplete) {
                    self.test.assertAnd(cmd.expected,
                                        msg, 'obj vs msg object');
                  } else {
                    for (key in cmd.expected) {
                      self.test.assertAnd(cmd.expected[key], msg[key], 'checking for property: '+key);
                    }
                    console.log('self.self.test.result(): ', self.test.assert.msg);
                    if (self.test.result() !== false) {
                      self.test.result(true);
                    } else {
                      self.test.result(false, self.test._message);
                    }
                    //console.log("HERE: ", self.test);
                    /*self.test.assert(self.test.result,
                      msg, 'obj vs msg object');*/
                  }
                }

                // control flow shouldn't get this far if the callback wasn't defined
                if (onComplete) {
                  cmd.callbacks.onComplete(msg);
                }
              } else {
                self.test.result(false, 'WebSocketClient: no result set to auto verify');
              }
            }
          } else if (typeof cmd.callbacks.onMessage === 'function') {
            cmd.callbacks.onMessage(message);
          }
        });

        // helper function for tests to verify the command and mark test
        // complete if the verification is successful against the test
        // data passed in during the instantiation in the controller.
        connection.sendAndVerify = function (command, expected, confirmProps, junk) {
          if (typeof junk === 'object') {
            // backward compatibility for when we used to have the test object
            // passed in, before confirmProps. (command, expected, test, confirmProps)
            cmd.confirmProps = junk;
          } else {
            if ((typeof confirmProps === 'object') &&
                (confirmProps.type !== 'Scaffolding')) {
              // not a test object, so we can use it
              cmd.confirmProps = confirmProps;
            }
          }
          cmd.receivedConfirm = false;
          cmd.command = command;
          cmd.expected = expected;
          cmd.autoVerify = true;
          connection.sendUTF(command);
        };
        // another helper function to assist with an async test that doesn't
        // want to use auto-verify. You can do your verification in the
        // callback methods you specify
        connection.sendWithCallback = function (command, onMessage, onError) {
          cmd.command = command;
          cmd.autoVerify = false;
          cmd.callbacks.onMessage= onMessage;
          cmd.callbacks.onError = onError;
          connection.sendUTF(command);
        };

        // meant to replace sendWithCallback and sendAndVerify, using a params object
        // to specify all the various details which configure the behavior of the
        // function.
        //
        // {
        //   send: JSON.stringify(data),
        //   expect: expected,
        //   confirmProps: confirmProps,
        //   autoVerify: true,
        //   onComplete: function() { }, // if callback function is called, verification is used with assertAnd, not assert
        //   onMessage: function() { },
        //   onError: function() { },
        // }
        connection.sendWith = function (params) {
          cmd.command = (params.send) ? params.send : undefined;
          cmd.confirmProps = (params.confirmProps) ? params.confirmProps : undefined;
          cmd.expected = (params.expect) ? params.expect : undefined;
          cmd.receivedConfirm = false;
          cmd.autoVerify = (params.autoVerify) ? true : false;
          cmd.callbacks.onComplete = (params.onComplete) ? params.onComplete : undefined;
          cmd.callbacks.onMessage= (params.onMessage) ? params.onMessage : undefined;
          cmd.callbacks.onError = (params.onError) ? params.onError : undefined;

          if ((cmd.callbacks.onMessage === undefined) && (cmd.autoVerify === false)) {
            write('[WebSocketClient]: neither autoVerify or onMessage were specified, no resolution can occur.');
          }
          connection.sendUTF(cmd.command);
        };

        onComplete(connection); // connection established, return
        // modified connection object to test suite.
      });

      client.connect(this.url, this.type);
    };

    return WebSocketClient;
  });
} else { //Browser
  define([], function() { return {}});
}
