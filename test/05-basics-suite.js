if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
//define(function () {
  var suites = [];

  suites.push({
    name: "basic tests",
    desc: "collection of basic tests to test sockethub behavior",
    setup: function (env, test) {

      env.confirmProps = {
        status: true,
        verb: 'confirm'
      };

      var port = 99550;
      env.client = new this.WebSocketClient({
        url: 'ws://localhost:'+port+'/sockethub',
        type: 'sockethub'
      });

      var config = {};
      config.HOST = {
        ENABLE_TLS: false,
        PORT: port,
        PROTOCOLS: [ 'sockethub' ],
        MY_PLATFORMS: [ 'dispatcher', 'smtp' ] // list of platforms this instance is responsible for
      };

      listener = require('../lib/protocols/sockethub/listener');
      for (var i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
        if (config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
          continue;
        }
        l  = Object.create(listener);
        l.init(config.HOST.MY_PLATFORMS[i]);
      }

      var dispatcher = require('../lib/protocols/sockethub/dispatcher');

      dispatcher.init().then(function() {
        // initialize http server
        var server = require('../lib/httpServer').init(config);
        // initialize websocket server
        var wsServer = require('../lib/wsServer').init(config, server, dispatcher);

        console.log(' [*] finished loading' );
        console.log();
        env.client.connect(function(connection) {
          env.connection = connection;
          test.result(true);
        });
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
          env.connection.sendAndVerify(
            'helloWorld',
            '{"status":false,"message":"invalid JSON received"}',
            test);
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
              '{"verb":"confirm","status":false,"message":"no rid (request ID) specified"}',
              test);
        }
      },

      {
        desc: "send something without an rid and invalid expected",
        willFail: true,
        run: function (env, test) {
          var data = {
            platform: "dispatcher",
            verb: "register"
          };
          var expected = {
            status: false,
            message: "no rid (request ID) specified. YARG!",
            verb: 'confirm'
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test);
        }
      },

      {
        desc: "send something without a platform",
        run: function (env, test) {
          var data = {
            verb: "register",
            rid: "123454"
          };
          var expected = {
            status: false,
            message: "no platform specified",
            rid: "123454",
            verb: 'confirm'
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test);
        }
      },

      {
        desc: "send something without a verb",
        run: function (env, test) {
          var data = {
            platform: "dispatcher",
            rid: "123454"
          };
          var expected = {
            status: false,
            message: "no verb (action) specified",
            rid: "123454",
            verb: 'confirm',
            platform: "dispatcher"
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test);
        }
      },

      {
        desc: "send something with unknown verb",
        run: function (env, test) {
          var data = {
            verb: 'blah',
            platform: "dispatcher",
            rid: "123454"
          };
          var expected = {
            status: false,
            message: "unknown verb received: blah",
            rid: "123454",
            verb: 'confirm',
            platform: "dispatcher"
          };
          console.log('-- EXPECTED: '+JSON.stringify(expected));
          env.connection.sendAndVerify(JSON.stringify(data), expected, test);
        }
      },

      {
        desc: "try a platform/verb without register",
        run: function (env, test) {
          var data = {
            platform: "dispatcher",
            verb: "ping",
            rid: "123454"
          };
          var expected = {
            status: false,
            message: "session not registered, cannot process verb",
            rid: "123454",
            verb: 'confirm',
            platform: "dispatcher"
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test);
        }
      },

      {
        desc: "register",
        run: function (env, test) {
          var data = {
            platform: "dispatcher",
            object: {
              secret: '1234567890'
            },
            verb: "register",
            rid: "123454"
          };
          var expected = {
            status: true,
            rid: "123454",
            verb: 'register',
            platform: "dispatcher"
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test, env.confirmProps);
        }
      },

      {
        desc: "register with wrong confirmProps",
        willFail: true,
        run: function (env, test) {
          var confirmProps = {
            "verb" : "coinform",
            "status" : true
          };
          var data = {
            platform: "dispatcher",
            object: {
              secret: '1234567890'
            },
            verb: "register",
            rid: "123454"
          };
          var expected = {
            status: true,
            rid: "123454",
            verb: 'register',
            platform: "dispatcher"
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test, confirmProps);
        }
      }

    ]
  });

  return suites;
});
