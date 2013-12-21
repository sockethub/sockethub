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
    takedown: function (env, test) {
      env.session.cleanup();
      test.result(true);
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
          console.log('credentials', env.verbs.credentials)
          return env.psession.setConfig('credentials', env.verbs.credentials);
        }
      },
      {
        desc: "#join",
        run: function (env, test) {
          var verb = 'join';
          return env.p_irc[verb](env.verbs[verb][0]);
        }
      },
      {
        desc: "#join calls stubs",
        run: function (env, test) {
          var verb = 'join';
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(env.verbs[verb][0].actor.address), 2); // #sockethub & #remotestore
        }
      },
      {
        desc: "#send",
        run: function (env, test) {
          var verb = 'send';
          return env.p_irc[verb](env.verbs[verb][0]);
        }
      },
      {
        desc: "#send calls stubs",
        run: function (env, test) {
          var verb = 'send';
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(env.verbs[verb][0].actor.address), 3); // #sockethub
        }
      },
      {
        desc: "#leave",
        run: function (env, test) {
          var verb = 'leave';
          return env.p_irc[verb](env.verbs[verb][0]);
        }
      },
      {
        desc: "#leave calls stubs",
        run: function (env, test) {
          var verb = 'leave';
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(env.verbs[verb][0].actor.address), 4); // #remotestorage
        }
      },
      {
        desc: "#observe",
        run: function (env, test) {
          var verb = 'observe';
          return env.p_irc[verb](env.verbs[verb][0]);
        }
      },
      {
        desc: "#observe calls stubs",
        run: function (env, test) {
          var verb = 'observe';
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(env.verbs[verb][0].actor.address), 5); // #remotestorage
        }
      },
      {
        desc: "#update topic",
        run: function (env, test) {
          var verb = 'update';
          return env.p_irc[verb](env.verbs[verb][0]);
        }
      },
      {
        desc: "#update topic calls stubs",
        run: function (env, test) {
          var verb = 'update';
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(env.verbs[verb][0].actor.address), 6); // #remotestorage
        }
      },
      {
        desc: "#update nick",
        run: function (env, test) {
          var verb = 'update';
          return env.p_irc[verb](env.verbs[verb][1]);
        }
      },
      {
        desc: "#update nick calls stubs",
        run: function (env, test) {
          var verb = 'update';
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(env.verbs[verb][0].actor.address), 7); // #remotestorage
        }
      },
      {
        desc: "#join with old credentials",
        run: function (env, test) {
          var verb = 'join';
          return env.p_irc[verb](env.verbs[verb][0]);
        }
      },
      {
        desc: "#join with old credentials makes new client (calls createClient again)",
        run: function (env, test) {
          var verb = 'join';
          test.assertAnd(env.api.createClient.numCalled, 2);
          test.assert(env.IRCFactory.ClientNumCalled(env.verbs[verb][0].actor.address), 2); // #sockethub & #remotestore
        }
      },
      {
        desc: "#send with renamed creds",
        run: function (env, test) {
          var verb = 'send';
          return env.p_irc[verb](env.verbs[verb][1]);
        }
      },
      {
        desc: "#send with renamed creds calls stubs",
        run: function (env, test) {
          var verb = 'send';
          // ensure new client was not created
          test.assertAnd(env.api.createClient.numCalled, 2);
          // new object was not used to send message
          test.assert(env.IRCFactory.ClientNumCalled(env.verbs[verb][0].actor.address), 2);
        }
      }
    ]
  });

  return suites;
});