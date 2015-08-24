if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define([], function () {
  var suites = [];

  suites.push({
    name: "WebSocket tests",
    runInBrowser: false,
    desc: "collection of tests to test WebSocket communication",
    setup: function (env, test) {
      env.expected = { // struct of expected results for each http call
        setupTest: { test: 'setupTest' },
        test: {
          foo: "bar"
        },
        footwear: {
          leather: "boots",
          flip: "flops",
          block: "of wood"
        },
        complex: {
          we: "are",
          using: [ "a", "complex", "data"],
          struct: [
            {
              here: "because",
              it: ['makes', 'us', {feel: "better"}, "about"]
            },
            "things"
          ]
        }
      };

      var client = new this.WebSocketClient({
        url: 'ws://localhost:9992/',
        type: 'echo-protocol'
      });
      var server = new this.WebSocketServer({
        port: 9992,
        messages: env.expected
      });

      var _this = this;
      server.run(function () {
        _this.write('websocket dummy server running');
        // setup client
        client.connect(function (connection) {
          env.connection = connection;
          env.connection.sendWith({
            send: 'setupTest',
            expect: env.expected.setupTest,
            autoVerify: true
          });
        });
      });
    },
    tests: [
      {
        desc: "first test",
        run: function (env, test) {
          this.assertAnd(env.connection.connected, true);
          env.connection.sendWith({
            send: 'test',
            expect: env.expected['test'],
            autoVerify: true
          });
        }
      },
      {
        desc: "complex data struct",
        run: function (env, test) {
          env.connection.sendWith({
            send: 'complex',
            expect: env.expected['complex'],
            autoVerify: true
          });
        }
      },
      {
        desc: "with callback",
        run: function (env, test) {
          env.connection.sendWith({
            send: 'footwear',
            onMessage: function (data) {
                test.assert(data.utf8Data, JSON.stringify(env.expected['footwear']));
              }
          });
        }
      },
      {
        desc: 'lets try to fail! how exciting!',
        willFail: true,
        run: function (env, test) {
          env.connection.sendWith({
            send: 'dontexist',
            expect: 'lalaa',
            autoVerify: true
          });
        }
      },
      {
        desc: "use autoVerify with onComplete callback",
        run: function (env, test) {
          env.connection.sendWith({
            send: 'complex',
            expect: env.expected['complex'],
            autoVerify: true,
            onComplete: function(msg) {
              // after autoVerify, callback here
              test.write('back from autoVerify');
              test.result(true);
            }
          });
        }
      },
      {
        desc: "use autoVerify with onComplete callback - fail before",
        willFail: true,
        run: function (env, test) {
          env.connection.sendWith({
            send: 'complexa',
            expect: env.expected['complex'],
            autoVerify: true,
            onComplete: function(msg) {
              // after autoVerify, callback here
              test.write('back from autoVerify');
              test.result(true);
            }
          });
        }
      }
    ]
  });

  return suites;
});