require("consoleplusplus/console++");
if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "xmpp platform tests",
    desc: "collection of tests for the xmpp platform",
    setup: function (env, test) {
      var promising = require('promising');

      env.xmpp = (function () {
        var callbacks = {};
        return {
          on: new test.Stub(function (name, cb) {
            console.log('XMPP STUB: on '+name);
            callbacks[name] = cb;
          }),
          send: new test.Stub(function (address, text) {
            console.log("XMPP STUB: send");
          }),
          connect: new test.Stub(function (creds) {
            console.log('XMPP STUB: connect');
            if (typeof callbacks.online === 'function') {
              callbacks['online']();
            }
          }),
          getRoster: new test.Stub(function (creds) {
            console.log('XMPP STUB: getRoster');
            //if (typeof callbacks.online === 'function') {
            //  callbacks['online']();
            //}
          })
        };
      })();
      GLOBAL.xmpp = env.xmpp;

      env.respHandler = function (testObj) {
        return function(err, status, obj) {
          if (testObj !== undefined) {
            testObj.write(' responseHandler: ['+err+'] ['+status+'] ['+obj+']');
            testObj.result(status);
          } else {
            test.write(' responseHandler: ['+err+'] ['+status+'] ['+obj+']');
          }
        };
      };

      GLOBAL.redis = require('redis');
      env.Session = require('./../lib/sockethub/session')('xmpp', '1234567890', 'abcde');
      env.Session.get('testsess1').
        then(function (session) {
          env.session = session;

          return session.getPlatformSession('xmpp');
        }).
        then(function (psession) {
          env.psession = psession;
          env.psession.send = function (job) {
            test.write('psession send called:',job);
          };
          var XMPPMod = require('./../lib/platforms/xmpp');

          env.XMPP = XMPPMod();
          env.XMPP.init(psession).then(function() {
            test.result(true);
          }, function(err) {
            test.result(false, err);
          });
        });
    },
    takedown: function (env, test) {
      env.Session.destroy(env.session.getSessionID()).then(function () {
        test.result(true);
      }, function (err) {
        test.result(false, err);
      });
    },
    beforeEach: function (env, test) {
      test.result(true);
    },
    tests: [
      {
        desc: "set credential details",
        run: function (env, test) {
          var job = {
            target: 'xmpp',
            object: {
              credentials: {
                "user@example.com": {
                  actor: {
                    address: "user@example.com"
                  },
                  username: "user@example.com",
                  password: "1234",
                  server: "example.com",
                  resource: "Home"
                }
              }
            }
          };

          env.psession.setConfig('credentials', job.object.credentials).then(function () {
            env.psession.getConfig('credentials').then(function (creds) {
              console.log('CREDS:', creds);
              test.assert(creds, job.object.credentials);
            }, function (err) {
              test.result(false, err);
            });
          }, function (err) {
            test.result(false, err);
          });
        }
      },
      {
        desc: "get credential details",
        run: function (env, test) {
          var job = {
            target: 'xmpp',
            object: {
              credentials: {
                "user@example.com": {
                  actor: {
                    address: "user@example.com"
                  },
                  username: "user@example.com",
                  password: "1234",
                  server: "example.com",
                  resource: "Home"
                }
              }
            }
          };

          env.psession.getConfig('credentials').then(function (creds) {
            test.assert(creds, job.object.credentials);
          }, function (err) {
            test.result(false, err);
          });
        }
      },
      {
        desc: "xmpp.send() eventually calls xmpp.send",
        run: function (env, test) {
          var job = {
            rid: '002',
            verb: 'send',
            platform: 'xmpp',
            actor: { address: 'user@example.com' },
            target: [{ address: 'test@test.com' }],
            object: { text: 'hello world' }
          };

          env.XMPP.send(job).then(function () {
            console.log('env.xmpp.connect: ', env.xmpp.connect);
            console.log('env.xmpp.connect numCalled: ', env.xmpp.connect.numCalled);
            console.log('env.xmpp.connect: ', env.xmpp.connect.called);
            test.assertAnd(env.xmpp.connect.called, true);
            test.assert(env.xmpp.send.called, true);
          });

        }
      }
    ]
  });

  return suites;
});
