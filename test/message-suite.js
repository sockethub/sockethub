if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "basic tests",
    desc: "collection of basic tests to test sockethub behavior",
    setup: function (env) {
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
        MY_PLATFORMS: [ 'smtp', 'facebook' ] // list of platforms this instance is responsible for
      };

      config.PLATFORMS = {
        // location of platforms running, defaults to this host
        'smtp' : {
          'host': 'http://localhost',
          'port': config.HOST.PORT
        },
        'facebook': {
          'host': 'http://localhost',
          'port': config.HOST.PORT
        }
      };

      var server = require('../lib/httpServer').init(config);

      // initialize websocket server
      var wsServer = require('../lib/wsServer').init(config, server);
      this.result(true);
    },
    tests: [
      {
        desc: "verify connection",
        run: function (env) {
          // setup client
          var _this = this;
          env.client.connect(function (connection) {
            env.connection = connection;
            env.connection.sendAndVerify('helloWorld', _this);
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