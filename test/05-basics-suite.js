require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
var _require = require;
define(['require'], function (require) {
//define(function () {
  var suites = [];

  suites.push({
    name: "basic tests",
    desc: "collection of basic tests to test sockethub behavior",
    abortOnFail: true,
    setup: function (env, test) {

      env.confirmProps = {
        status: true,
        verb: 'confirm'
      };

      var port = 10999;
      env.client = new this.WebSocketClient({
        url: 'ws://localhost:'+port+'/sockethub',
        type: 'sockethub'
      });

      console.log("TEST: ", _require.cache);
      var config = {
        PLATFORMS: ['dispatcher', 'email'],
        HOST: {
          ENABLE_TLS: false,
          PORT: port,
          PROTOCOLS: [ 'sockethub' ],
          MY_PLATFORMS: [ 'dispatcher', 'email' ] // list of platforms this instance is responsible for
        },
        EXAMPLES: {
          ENABLE: false
        },
        DEBUG: true,
        LOG_FILE: '',
        BASE_PATH: '../../../../'
      };
      var sockethubId = Math.floor((Math.random()*10)+1) + new Date().getTime();


      env.sockethub = require('./../lib/sockethub/sockethub')({
        root: './',
        debug: false,
        sockethubId: sockethubId,
        config: config,
        secrets: ['1234567890']
      });

      env.sockethub.events.on('initialized', function () {
        env.client.connect(function (connection) {
          env.connection = connection;
          test.result(true);
        });
      });

    },
    takedown: function (env, test) {
      env.sockethub.shutdown().then(function() {
        test.result(true);
      });
    },
    tests: [

      {
        desc: "verify connection with bad JSON",
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
        desc: "register with invalid secret",
        run: function (env, test) {
          var data = {
            platform: "dispatcher",
            object: {
              secret: 'bababa'
            },
            verb: "register",
            rid: "123454"
          };
          var expected = {
            status: false,
            rid: "123454",
            verb: 'register',
            platform: "dispatcher"
          };
          var result = '{"rid":"123454","platform":"dispatcher","verb":"register","status":false,"message":"registration failed, invalid secret."}';
          env.connection.sendAndVerify(JSON.stringify(data), result, test, env.confirmProps);
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
