require("consoleplusplus/console++");
if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "irc platform tests",
    desc: "collection of tests for the irc platform",
    setup: function (env, test) {
      // load session manager
      env.sessionManager = require('./../lib/sockethub/session')({
        platform: 'irc',
        sockethubId:'1234567890',
        encKey:'abcde'
      });
      test.assertTypeAnd(env.sessionManager.get, 'function');

      // irc-factory mock
      var IRCFactory = require('./mocks/irc-factory-mock')(test);
      GLOBAL.IRCFactory = IRCFactory;
      GLOBAL.redis = require('redis');

      env.api = IRCFactory.Api();
      test.assertTypeAnd(env.api, 'object');
      test.assertTypeAnd(env.api.createClient, 'function');

      env.client = env.api.createClient('testkey', {});
      test.assertAnd(env.api.createClient.called, true);
      test.assert(env.client.irc.raw.called, false);
    },
    tests: [
      {
        desc: "create platform session",
        run: function (env, test) {
          env.sessionManager.get('testsession').
            then(function (session) {
              env.session = session;
              test.assertTypeAnd(env.session.getPlatformSession, 'function');
              return session.getPlatformSession('irc');

            }).then(function (psession) {
              env.psession = psession;
              test.assertTypeAnd(env.psession.send, 'function');
              // overwrite real send function with a stub
              env.psession.send = test.Stub(function (job) {
                test.write('psession send called:',job);
              });
              test.assert(env.psession.send.called, false);
            }, function(err) {
              test.result(false, err);
            });
        }
      },
      {
        desc: "load platform",
        run: function (env, test) {
          var platformIRC = require('./../lib/platforms/irc');
          env.platformIRC = platformIRC();
          env.platformIRC.init(env.psession).then(function() {
            test.result(true);
          }, function(err) {
            test.result(false, err);
          });
        }
      }
    ]
  });

  return suites;
});