if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "basic tests",
    desc: "collection of basic tests to test sockethub behavior",
    setup: function (env, test) {
      env.expected = { // struct of expected results for each http call
        helloWorld: '{"undefined":{"status": false, "message": "no command specified", "data":"[object Object]"}}',
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

      var port = 99550;
      env.client = new this.WebSocketClient({
        url: 'ws://localhost:'+port+'/sockethub',
        type: 'sockethub',
        messages: env.expected // used for auto verification (if specified
                     // by using the sendAndVerify() method in the
                     // test).
      });

      var config = {};
      config.HOST = {
        ENABLE_TLS: false, // it is stronlgly recommended that you leave TLS enabled
                          // unless your TLS needs are already taken care of via. a
                          // proxy, or you are running in a development environment.
        TLS_CERTS_DIR: '/path/to/tls',
        PORT: port,
        PROTOCOLS: [ 'sockethub' ],
        MY_PLATFORMS: [ 'dispatcher', 'smtp', 'facebook' ] // list of platforms this instance is responsible for
      };

      listener = require('../lib/protocols/sockethub/listener');
      for (var i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
        if (config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
          continue;
        }
        l  = Object.create(listener);
        l.init(config.HOST.MY_PLATFORMS[i]);
      }

      var dispatcher, promise;
      try {
        dispatcher = require('../lib/protocols/sockethub/dispatcher');
      } catch (e) {
        throw e;
      }

      promise = dispatcher.init();
      promise.then(function() {
          var server = require('../lib/httpServer').init(config);

          // initialize websocket server
          var wsServer = require('../lib/wsServer').init(config, server, dispatcher);

          console.log(' [*] finished loading' );
          console.log();
          test.result(true);
      }, function(err) {
          console.log(" [sockethub] dispatcher failed initialization, aborting");
          process.exit();
      });

    },
    tests: [
      {
        desc: "verify connection",
        run: function (env, test) {
          // setup client
          var _this = this;
          env.client.connect(function (connection) {
            env.connection = connection;
            env.connection.sendAndVerify('helloWorld', test);
          });
          //this.assertAnd(env.connection.connected, true);
          //env.connection.sendAndVerify('test', this);
        }
      },
      {
        desc: "complex data struct",
        run: function (env) {
          env.connection.sendAndVerify('complex', this);
        }
      },
      {
        desc: "with callback",
        run: function (env) {
          var _this = this;
          env.connection.sendWithCallback('footwear', function (data) {
            _this.assert(data.utf8Data,
                   JSON.stringify(env.expected['footwear']));
          });
        }
      },
      {
        desc: 'lets try to fail! how exciting!',
        willFail: true,
        run: function (env) {
          env.connection.sendAndVerify('dontexist', this);
        }
      }
    ]
  });

  return suites;
});