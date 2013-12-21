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

      env.xmpp = require('./mocks/simple-xmpp-mock')(test);
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
      env.sessionManager = require('./../lib/sockethub/session')({platform: 'xmpp', sockethubId:'1234567890', encKey:'abcde'});
      env.sessionManager.get('testsess1').
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
      env.sessionManager.destroy(env.session.getSessionID()).then(function () {
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
            actor: { address: 'user@example.com' },
            target: [{
              address: 'xmpp'
            }],
            object: {
              objectType: 'credentials',
              username: "user@example.com",
              password: "1234",
              server: "example.com",
              resource: "Home"
            }
          };

          env.psession.setConfig('credentials', job.actor.address, job).then(function () {
            env.psession.getConfig('credentials', job.actor.address).then(function (creds) {
              console.log('CREDS: J', job);
              console.log('CREDS: C', creds);
              test.assert(creds, job);
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
            actor: { address: 'user@example.com' },
            target: [{
              address: 'xmpp'
            }],
            object: {
              objectType: 'credentials',
              username: "user@example.com",
              password: "1234",
              server: "example.com",
              resource: "Home"
            }
          };

          env.psession.getConfig('credentials', job.actor.address).then(function (creds) {
            test.assert(creds, job);
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
