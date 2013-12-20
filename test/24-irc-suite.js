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

      // verbs
      env.verbs = require('./platforms_schema_data/irc_verbs');
      test.assertTypeAnd(env.verbs, 'object');

      // irc-factory mock
      env.IRCFactory = require('./mocks/irc-factory-mock')(test);
      GLOBAL.IRCFactory = env.IRCFactory;
      GLOBAL.redis = require('redis');

      env.api = IRCFactory.Api();
      test.assertTypeAnd(env.api, 'object');
      test.assertType(env.api.createClient, 'function');
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
          env.p_irc = require('./../lib/platforms/irc')();
          test.assertType(env.p_irc.init, 'function');
        }
      },
      {
        desc: "#init",
        run: function (env, test) {
          return env.p_irc.init(env.psession);
        }
      },
      {
        desc: "set credentials",
        run: function (env, test) {
          return env.psession.setConfig('credentials', env.verbs.credentials);
        }
      },
      {
        desc: "#join",
        run: function (env, test) {
          return env.p_irc.join(env.verbs.join[0]);
        }
      },
      {
        desc: "#join calls stubs",
        run: function (env, test) {
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(), 2); // #sockethub & #remotestore
        }
      }
    ]
  });

  return suites;
});