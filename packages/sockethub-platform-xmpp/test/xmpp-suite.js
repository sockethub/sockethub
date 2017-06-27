if(typeof(define) !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "xmpp platform tests",
    desc: "collection of tests for the xmpp platform",
    abortOnFail: true,
    setup: function (env, test) {
      // load session manager
      env.session = require('./../node_modules/sockethub-testing-mocks/mock-session')(test);
      test.assertTypeAnd(env.session.store.get, 'function');
      test.assertTypeAnd(env.session.store.save, 'function');

      env.tv4 = require('./../node_modules/tv4/tv4');

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

      env.actor2 = {
        '@type': 'person',
        '@id': 'xmpp:testingturkey@jabber.net',
        displayName:'testingturkey'
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

      env.credentials2 = {
        actor: env.actor2,
        object: {
          '@type': 'credentials',
          username: 'testingturkey',
          server: 'jabber.net',
          password: 'foobar',
          resource: 'home'
        }
      };

      env.bad = {
        credentials: {
          one: {
            host: 'example.com',
            port: '6667'
          },
          two: {
            object: {
              nick: 'testingham',
              server: 'jabber.net'
            }
          }
        }
      };

      env.target = {
        mrfoobar: {
          '@type': 'person',
          '@id': 'xmpp:jabber.net/mrfoobar',
          displayName: 'Mr FooBar'
        },
        partyroom: {
          '@type': 'room',
          '@id': 'xmpp:partyroom@jabber.net'
        }
      };

      env.job = {
        join: {
          actor: env.actor,
          object: {
            '@type': 'update',
            displayName: 'Frank'
          },
          target: env.target.partyroom
        },
        send: {
          actor: env.actor,
          object: {
            '@type': 'message',
            content: 'hello'
          },
          target: env.target.mrfoobar
        },
        update: {
          presence: {
            actor: env.actor,
            object: {
              '@type': 'presence',
              presence: 'available',
              status: 'available'
            }
          }
        },
        observe: {
          actor: env.actor,
          target: env.target.partyroom,
          object: {
            '@type': 'attendance'
          }
        }
      };

      env.job2 = {
        send: {
          actor: env.actor2,
          object: {
            '@type': 'message',
            content: 'hello'
          },
          target: env.target.mrfoobar
        }
      };

      // schema
      env.schema = env.platform.schema;

      // types
      env.types = env.schema.messages.properties['@type'].enum;
      test.assertAnd(env.types.sort(), [ 'update', 'make-friend', 'send', 'remove-friend', 'request-friend', 'join', 'connect', 'observe' ].sort());

      test.assertTypeAnd(env.xmpp, 'object');
      test.assertType(env.xmpp.connect, 'function');
    },
    takedown: function (env, test) {
      env.platform.cleanup(function () {
        test.done();
      });
    },
    tests: [
      {
        desc: 'bad credentials #one',
        run: function (env, test) {
          test.assert(env.tv4.validate(env.bad.credentials.one, env.schema.credentials), false);
        }
      },

      {
        desc: 'bad credentials #two',
        run: function (env, test) {
          test.assert(env.tv4.validate(env.bad.credentials.two, env.schema.credentials), false);
        }
      },

      {
        desc: 'good credentials',
        run: function (env, test) {
          test.assert(env.tv4.validate(env.credentials, env.schema.credentials), true);
        }
      },

      {
        desc: "set credentials",
        run: function (env, test) {
          env.session.store.save(env.actor['@id'],
                                 env.credentials, function () {
                                 test.done();
                                });
        }
      },

      {
        desc: "# join",
        run: function (env, test) {
          env.platform.join(env.job.join, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertTypeAnd(result, 'undefined');
            test.assert(env.xmpp.join.numCalled, 1);
          });
        }
      },

      {
        desc: "# join - sets the proper target",
        run: function (env, test) {
          const originalJoin = env.xmpp.join;
          env.xmpp.join = new test.Stub(function(target) {
            test.assert(target, 'xmpp:partyroom@jabber.net/testingham');
            env.xmpp.join = originalJoin;
          });

          env.platform.join(env.job.join);
        }
      },

      {
        desc: "# send 1",
        run: function (env, test) {
          env.platform.send(env.job.send, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertTypeAnd(result, 'undefined');
            test.assert(env.xmpp.send.numCalled, 1);
          });
        }
      },
      {
        desc: "# send 2",
        run: function (env, test) {
          env.platform.send(env.job.send, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertTypeAnd(result, 'undefined');
            test.assert(env.xmpp.send.numCalled, 2);
          });
        }
      },
      {
        desc: "# send - check stubs",
        run: function (env, test) {
          test.assert(env.xmpp.connect.numCalled, 1);
        }
      },

      {
        desc: "# update presence",
        run: function (env, test) {
          env.platform.update(env.job.update.presence, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertTypeAnd(result, 'undefined');
            test.assert(env.xmpp.setPresence.numCalled, 1);
          });
        }
      },

      {
        desc: "set second credentials",
        run: function (env, test) {
          env.session.store.save(env.actor2['@id'],
                                 env.credentials2, function () {
                                 test.done();
                                });
        }
      },

      {
        desc: "# send with second credentials",
        run: function (env, test) {
          env.platform.send(env.job2.send, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertTypeAnd(result, 'undefined');
            test.assertAnd(env.xmpp.send.numCalled, 3);
            test.assert(env.xmpp.connect.numCalled, 2);
          });
        }
      },

      {
        desc: "# observe",
        run: function (env, test) {
          const originalSend = env.xmpp.conn.send;
          env.xmpp.conn.send = new test.Stub(function(stanza) {
            test.assertAnd(stanza.is('iq'), true);
            test.assertAnd(stanza.attrs.id, 'muc_id');
            test.assertAnd(stanza.attrs.from, 'xmpp:testingham@jabber.net');
            test.assert(stanza.attrs.to, 'xmpp:partyroom@jabber.net');
            env.xmpp.conn.send = originalSend;
          });

          env.platform.observe(env.job.observe, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertTypeAnd(result, 'undefined');
          });
        }
      }
    ]
  });

  return suites;
});
