if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "basic tests",
    desc: "collection of basic tests to test sockethub behavior",
    setup: function (env, test) {

      var port = 99550;
      env.client = new this.WebSocketClient({
        url: 'ws://localhost:'+port+'/sockethub',
        type: 'sockethub'
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
            env.connection.sendAndVerify('helloWorld',
                '{"status":false,"message":"invalid JSON received"}',
                test);
          });
        }
      },
      {
        desc: "send something without an rid",
        run: function (env, test) {
          var data = {
            platform: "dispatcher",
            verb: "register"
          };
          env.connection.sendAndVerify(JSON.stringify(data),
              '{"status":false,"message":"no rid (request ID) specified"}',
              test);
        }
      },
      {
        desc: "send something without a platform",
        run: function (env, test) {
          var data = {
            verb: "register",
            rid: "123454"
          };
          env.connection.sendAndVerify(JSON.stringify(data),
              '{"rid":"123454","status":false,"message":"no platform specified"}',
              test);
        }
      },
      {
        desc: "send something without a verb",
        run: function (env, test) {
          var data = {
            platform: "dispatcher",
            rid: "123454"
          };
          env.connection.sendAndVerify(JSON.stringify(data),
              '{"rid":"123454","platform":"dispatcher","status":false,"message":"no verb (action) specified"}',
              test);
        }
      }
    ]
  });

  return suites;
});