require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "full stack tests",
    desc: "tests for the full stack, using the email platform",
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
        MY_PLATFORMS: [ 'dispatcher', 'email' ] // list of platforms this instance is responsible for
      };

      var sockethubId = Math.floor((Math.random()*10)+1) + new Date().getTime();

      listener = require('./../lib/sockethub/listener');
      for (var i = 0, len = config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
        if (config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
          continue;
        }
        l  = listener();
        l.init(config.HOST.MY_PLATFORMS[i], sockethubId);
      }

      var dispatcher = require('./../lib/sockethub/dispatcher');

      env.server = {};
      dispatcher.init(config.HOST.MY_PLATFORMS, sockethubId).then(function() {
        // initialize http server
        env.server.h = require('./../lib/servers/http').init(config);
        // initialize websocket server
        env.server.ws = require('./../lib/servers/websocket').init(config, env.server.h, dispatcher);

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
    takedown: function (env, test) {
      env.connection.close();
      setTimeout(function() {
        //env.server.ws.close();
        env.server.h.close();
        setTimeout(function() {
          test.result(true);
        }, 1000);
      }, 1000);
    },
    tests: [

      {
        desc: "register without remoteStorage",
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
          env.connection.sendWith({
            send: JSON.stringify(data),
            onMessage: function (data) {
              var m = JSON.parse(data.utf8Data);
              if (m.verb === 'register') {
                test.assert(m.status, true);
              }
            }
          });
          //AndVerify(JSON.stringify(data), expected, test, env.confirmProps);
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
          /*
          var confirmProps = {
            status: false,
            rid: "123456",
            verb: 'confirm',
            platform: "email",
            message: "unknown verb received: foobar"
          };*/
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
            status: false,
            rid: "123454",
            verb: 'send',
            platform: "email",
            message:"could not get credentials"
          };
          var json_data = JSON.stringify(data);
          //console.log('JSON_DATA: ',json_data);
          env.connection.sendAndVerify(json_data, expected, test, env.confirmProps);
        }
      },

      {
        desc: "set credentials",
        run: function (env, test) {
          var data = {
            platform: "dispatcher",
            target: {
              platform: "email"
            },
            object: {
              credentials: {
                "user@example.com": {
                  smtp: {
                    username: 'user',
                    password: 'secretcode',
                    host: 'example.com'
                  }
                }
              }
            },
            verb: "set",
            rid: "123454"
          };
          var expected = {
            status: true,
            rid: "123454",
            verb: 'set',
            platform: "dispatcher"
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test, env.confirmProps);
        }
      },

      {
        desc: "try to send with set credentials",
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
            status: true,
            rid: "002",
            verb: 'send',
            platform: "email"
          };
          env.connection.sendAndVerify(JSON.stringify(data), expected, test, env.confirmProps);
        }
      },

      {
        desc: "verify mailer was called",
        run: function (env, test) {
          test.assert(env.nodemailer.createTransport.called, true);
        }
      }


    ]
  });

  return suites;
});
