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
      // irc-factory mock
      env.xmpp = require('./mock-simple-xmpp')(test);
      env.IncomingHandlers = require('./../lib/incoming-handlers');
      env.xmpp.mock = true;
      global.xmpp = env.xmpp;

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

      var Platform = require('./../index');
      env.platform = new Platform({
        id: env.actor.actor,
        debug: console.log
      });
      env.platform.actor = 'user@jabber.org';

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
    data.forEach((entry) => {
      tests.push({
        desc: '# incoming data: ' + entry.name,
        run: function (env, test) {
          var inputParams;
          if (typeof entry.input === 'string') {
            inputParams = [ltx.parse(entry.input)]; // Stanza
          } else {
            inputParams = entry.input; // array of params
          }
          env.platform.sendToClient = function (msg) {
            console.log('sendToClient: ', msg);
            console.log('expected:', entry.output);
            test.assert(msg, entry.output);
          };
          const func  = entry.handler || '__stanza';
          const ih = new env.IncomingHandlers(env.platform, 'user@jabber.org');
          console.log('function: ' + func, typeof ih[func]);
          ih[func](...inputParams);
        }
      })
    });
    return tests;
  }

  return suites;
});

'{"@type":"send","actor":{"@type":"person","@id":"radical@example.org"},"target":"user@jabber.org","object":{"@type":"message","content":"ohai","@id":1}}'
'{"@type":"send","actor":{"@type":"person","@id":"radical@example.org"},"target":{"@id":"user@jabber.org"},"object":{"@type":"message","content":"ohai","@id":1}}'


