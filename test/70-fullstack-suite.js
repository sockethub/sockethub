require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "full stack tests",
    desc: "tests for the full stack, using the email platform",
    //abortOnFail: true,
    setup: function (env, test) {

      env.nodemailer = {};
      env.nodemailer.createTransport = test.Stub(function createTransportStub(name, obj) {
          if (name === 'SMTP') {
            console.log('NODEMAILER createTransport STUB CALLED');
            var ret =  {};
            ret.sendMail = test.Stub(function sendMail(msg, cb) {
                console.log('NODEMAILER sendMail STUB CALLED');
                cb(null, true);
              });

            return ret;
          }
        });
      GLOBAL.nodemailer = env.nodemailer;
      GLOBAL.redis = require('redis');

      env.confirmProps = {
        status: true,
        verb: 'confirm'
      };

      var port = 10999;

      env.config = {
        PLATFORMS: ['email'],
        HOST: {
          ENABLE_TLS: false,
          PORT: port,
          PROTOCOLS: [ 'sockethub' ],
          MY_PLATFORMS: [ 'dispatcher'] // list of platforms this instance is responsible for
        },
        DEBUG: true,
        EXAMPLES: {
          ENABLE: false
        },
        LOG_FILE: '',
        BASE_PATH: '../../../../'
      };


      var sockethubId = Math.floor((Math.random()*10)+1) + new Date().getTime() / Math.floor((Math.random()*10)+2);

      env.sockethub = require('./../lib/sockethub/sockethub')({
        root: './',
        debug: false,
        sockethubId: sockethubId,
        config: env.config
      });
      env.sockethub.events.on('initialized', function () {
        test.result(true);
      });

      var proto = require('./../lib/sockethub/protocol');
      listener = require('./../lib/sockethub/listener');
      for (var i = 0, len = env.config.PLATFORMS.length; i < len; i = i + 1) {
        if (env.config.PLATFORMS[i] === 'dispatcher') {
          continue;
        }
        l = listener({
          platform: proto.platforms[env.config.PLATFORMS[i]],
          sockethubId: sockethubId
        });
      }

    },
    takedown: function (env, test) {
      env.sockethub.shutdown();
      test.result(true);
    },
    tests: [

      {
        desc: "connect",
        run: function (env, test) {
          env.client = new this.WebSocketClient({
            url: 'ws://localhost:'+env.config.HOST.PORT+'/sockethub',
            type: 'sockethub'
          });
          env.client.connect(function(connection) {
            env.connection = connection;
            test.result(true);
          });
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
          console.log('calling env.connection.sendWith');
          env.connection.sendAndVerify(JSON.stringify(data), expected, test, env.confirmProps);
          console.log('end of test');
        }
      },

      {
        desc: "send invalid verb",
        willFail: true,
        run: function (env, test) {
          var data = {
            platform: "email",
            verb: "foobar",
            rid: "123456"
          };
          var expected = {

          };
          env.connection.sendWith({
            send: JSON.stringify(data),
            expect: expected,
            testObj: test,
            confirmProps: env.confirmProps,
            autoVerify: true
          });
        }
      },

      {
        desc: "attempt send without credentials",
        run: function (env, test) {
          var data = {
            platform: "email",
            actor: {
              address: "user@example.com"
            },
            object: {
              text: 'lalala'
            },
            target: [{ address: 'foo@bar.com' }],
            verb: "send",
            rid: "123454"
          };
          var expected = {
            actor: {address: 'user@example.com'},
            status: false,
            rid: "123454",
            verb: 'send',
            platform: "email",
            target: [{address: 'foo@bar.com'}],
            message: "credentials not found"
          };
          var json_data = JSON.stringify(data);
          console.log('JSON_DATA: ',json_data);
          env.connection.sendAndVerify(json_data, expected, test, env.confirmProps);
        }
      },

      {
        desc: "set credentials",
        run: function (env, test) {
          var data = {
            platform: "email",
            actor: {
              address: 'user@example.com'
            },
            object: {
              objectType: 'credentials',
              smtp: {
                username: 'user',
                password: 'secretcode',
                host: 'example.com'
              }
            },
            verb: "set",
            rid: "123454"
          };
          var expected = {
            status: true,
            rid: "123454",
            verb: 'set',
            platform: "email"
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test, env.confirmProps);
        }
      },

      {
        desc: "try to send with invalid platform",
        willFail: true,
        run: function (env, test) {
          var data = {
            rid: '002',
            verb: 'send',
            platform: 'emailo',
            actor: { address: 'user@example.com' },
            object: { subject: 'test email subject', text: 'test email body' },
            target: [{ address: 'user2@example.com' }]
          };

          var expected = {
            status: true,
            rid: "002",
            verb: 'send',
            platform: "email",
            target: [{ address: 'user2@example.com' }]
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test, env.confirmProps);
        }
      },

      {
        desc: "try to send with previsously set credentials",
        run: function (env, test) {
          var data = {
            rid: '002',
            verb: 'send',
            platform: 'email',
            actor: { address: 'user@example.com' },
            object: { subject: 'test email subject', text: 'test email body' },
            target: [{ address: 'user2@example.com.com' }]
          };

          var expected = {
            actor: {address: 'user@example.com'},
            status: true,
            rid: "002",
            verb: 'send',
            platform: "email",
            target: [{ address: 'user2@example.com.com' }]
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test, env.confirmProps);
        }
      },

      {
        desc: "verify mailer was called",
        run: function (env, test) {
          test.assert(env.nodemailer.createTransport.called, true);
        }
      },

      {
        desc: "connect+register fast, WebSocket-Node issue #91",
        timeout: 3000,
        run: function (env, test) {
          client = new this.WebSocketClient({
            url: 'ws://localhost:' + env.config.HOST.PORT + '/sockethub',
            type: 'sockethub'
          });
          client.connect(function (connection) {
            var data = {
              platform: "dispatcher",
              object: { secret: '1234567890' },
              verb: "register",
              rid: "123454"
            };
            var expected = {
              status: true,
              rid: "123454",
              verb: 'register',
              platform: "dispatcher"
            };
            connection.sendAndVerify(JSON.stringify(data), expected, test, env.confirmProps);
          });
        }
      },

      {
        desc: "try to call test.fetch which does not exist",
        willFail: true,
        run: function (env, test) {
          var data = {
            rid: '002',
            verb: 'fetch',
            platform: 'test',
            actor: { address: 'user@example.com' },
            object: { subject: 'test email subject', text: 'test email body' },
            target: [{ address: 'user2@example.com.com' }]
          };

          var expected = {
            status: true,
            rid: "002",
            verb: 'confirm',
            platform: "test",
            message: "platform 'test' not loaded"
          };
          env.connection.sendAndVerify(JSON.stringify(data), {}, test, expected);
        }
      }


    ]
  });

  return suites;
});
