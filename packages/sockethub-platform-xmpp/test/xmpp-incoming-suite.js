if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "xmpp incoming data handling tests",
    desc: "takes a list of paired data (incoming and expected result) to build a series of tests",
    abortOnFail: true,
    setup: function (env, test) {
      // load session manager
      env.session = require('./../node_modules/sockethub-testing-mocks/mock-session')(test);
      test.assertTypeAnd(env.session.store.get, 'function');
      test.assertTypeAnd(env.session.store.save, 'function');

      // irc-factory mock
      env.xmpp = require('./mock-simple-xmpp')(test);
      env.xmpp.mock = true;
      global.xmpp = env.xmpp;

      var Platform = require('./../index');
      env.platform = new Platform(env.session);

      env.actor = {
        '@type': 'person',
        '@id': 'xmpp:testingham@jabber.net',
        displayName:'testingham'
      };

      env.credentials = {
        actor: env.actor,
        object: {
          '@type': 'credentials',
          username: 'testingham',
          server: 'jabber.net',
          password: 'foobar',
          resource: 'home'
        }
      };

      test.assertTypeAnd(env.xmpp, 'object');
      test.assertType(env.xmpp.connect, 'function');
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
    var ltx = require('ltx');
    var tests = [];
    data.forEach(function(entry) {
      tests.push({
        desc: '# incoming data: ' + entry.name,
        run: function (env, test) {
          var stanza = ltx.parse(entry.input);
          env.session.callOnNext('send', function (msg) {
            test.assert(msg, entry.output);
          });
          env.platform.__listeners.stanza.apply({ scope: env.session }, [ stanza ]);
        }
      })
    })
    return tests;
  }

  return suites;
});