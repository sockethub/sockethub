if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "irc platform tests",
    desc: "collection of tests for the irc platform",
    abortOnFail: true,
    setup: function (env, test) {
      // load session manager
      env.session = require('./../node_modules/sockethub-testing-mocks/mock-session')(test);
      env.credentials = {
        actor: {
          '@id': 'irc://foobar@irc.freenode.net',
          displayName: 'foobar'
        },
        object: {
          server: 'irc.freenode.net',
        }
      }
      test.assertTypeAnd(env.session.store.get, 'function');
      test.assertTypeAnd(env.session.store.save, 'function');

      env.tv4 = require('./../node_modules/tv4/tv4');

      // irc-factory mock
      env.IRCFactory = require('./mock-irc-factory')(test);
      env.IRCFactory.mock = true;
      global.IRCFactory = env.IRCFactory;

      var Platform = require('./../index');
      env.platform = new Platform(env.session);

      // types
      env.types = env.schema.messages.properties['@type'].enum;
      test.assertAnd(env.types, [ 'update', 'join', 'leave', 'send', 'observe', 'announce' ]);

      env.api = IRCFactory.Api();
      test.assertTypeAnd(env.api, 'object');
      test.assertType(env.api.createClient, 'function');
    },
    takedown: function (env, test) {
      env.platform.cleanup(function () {
        test.done();
      });
    },
    tests: buildTests()
  });

  function buildTests() {
    var data = require('./incoming-data');
    var tests = [];
    data.forEach(function(entry) {
      tests.push({
        desc: '# incoming data: ' + entry.name,
        timeout: 3000,
        run: function (env, test) {
          env.session.callOnNext('send', function (msg) {
            test.assert(msg, entry.output);
          });
          env.platform.__listeners['*'].apply({ scope: env.session, credentials: env.credentials }, [ entry.input ]);
        }
      })
    })
    return tests;
  }

  return suites;
});
