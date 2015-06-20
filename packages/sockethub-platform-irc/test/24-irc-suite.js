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
      test.assertTypeAnd(env.session.store.get, 'function');
      test.assertTypeAnd(env.session.store.save, 'function');


      env.tv4 = require('./../node_modules/tv4/tv4');

      // irc-factory mock
      env.IRCFactory = require('./mock-irc-factory')(test);
      env.IRCFactory.mock = true;
      GLOBAL.IRCFactory = env.IRCFactory;

      var Platform = require('./../index');
      env.platform = new Platform(env.session);

      env.actor = {
        '@type': 'person',
        '@id': 'irc://testingham@irc.example.com',
        displayName:'testingham'
      };

      env.newActor = {
        '@type': 'person',
        '@id': 'irc://testler@irc.example.com',
        displayName:'testler'
      };

      env.credentials = {
        actor: env.actor,
        object: {
          '@type': 'credentials',
          nick: 'testingham',
          server: 'irc.example.com'
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
              server: 'irc.example.com'
            }
          }
        }
      };

      env.target = {
        sockethub: {
          '@type': 'room',
          '@id': 'irc://irc.example.com/sockethub',
          displayName: '#sockethub'
        },
        remotestorage: {
          '@type': 'room',
          '@id': 'irc://irc.example.com/remotestorage',
          displayName: '#remotestorage'
        }
      };

      env.job = {
        join: {
          sockethub: {
            actor: env.actor,
            target: env.target.sockethub
          },
          remotestorage: {
            actor: env.actor,
            target: env.target.remotestorage
          }
        },
        send: {
          actor: env.actor,
          object: {
            '@type': 'message',
            content: 'hello'
          },
          target: env.target.sockethub
        },
        leave:{
          actor: env.actor,
          object: {},
          target: env.target.remotestorage
        },
        observe: {
          actor: env.actor,
          object: {
            '@type': 'attendance'
          },
          target: env.target.sockethub
        },
        update: {
          topic: {
            actor: env.actor,
            object: {
              '@type': 'topic',
              displayName: 'welcome to unit testing, enjoy your stay - the management'
            },
            target: env.target.sockethub
          },
          nick: {
            actor: env.actor,
            target: env.newActor
          }
        }
      };

      // schema
      env.schema = env.platform.schema;

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
        desc: "# join 1 channel",
        run: function (env, test) {
          env.platform.join(env.job.join.sockethub, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# join 1 - check stubs",
        run: function (env, test) {
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(0), 1); // #sockethub
        }
      },

      {
        desc: "# join 2nd channel",
        run: function (env, test) {
          env.platform.join(env.job.join.remotestorage, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# join 2 - check stubs",
        run: function (env, test) {
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(0), 2); // #remotestorage
        }
      },

      {
        desc: "# send",
        run: function (env, test) {
          env.platform.send(env.job.send, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# send - check stubs",
        run: function (env, test) {
          var verb = 'send';
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(0), 3); // #sockethub
        }
      },

      {
        desc: "# leave",
        run: function (env, test) {
          env.platform.leave(env.job.leave, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# leave - check stubs",
        run: function (env, test) {
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(0), 4); // #remotestorage
        }
      },
      {
        desc: "# check internal prop _channels",
        run: function (env, test) {
          test.assert(env.platform._channels, ['#sockethub']);
        }
      },

      {
        desc: "# observe",
        run: function (env, test) {
          env.platform.observe(env.job.observe, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# observe - check stubs",
        run: function (env, test) {
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(0), 5); // #sockethub
        }
      },

      {
        desc: "# update topic",
        run: function (env, test) {
          env.platform.update(env.job.update.topic, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# update topic - check stubs",
        run: function (env, test) {
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(0), 6); // #sockethub
        }
      },

      {
        desc: "# update nick",
        run: function (env, test) {
          env.platform.update(env.job.update.nick, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err, err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# update nick - check stubs",
        run: function (env, test) {
          test.assertAnd(env.api.createClient.numCalled, 1);
          test.assert(env.IRCFactory.ClientNumCalled(0), 7);
        }
      },

      {
        desc: "# join with old credentials",
        run: function (env, test) {
          env.platform.join(env.job.join.remotestorage, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# join with old credentials makes new client (calls createClient again)",
        run: function (env, test) {
          test.assertAnd(env.api.createClient.numCalled, 2);
          test.assert(env.IRCFactory.ClientNumCalled(1), 1); // #sockethub
        }
      },

      {
        desc: "# send with renamed creds",
        run: function (env, test) {
          var job = env.job.send;
          job.actor = env.newActor;

          env.platform.send(job, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },

      {
        desc: "# send with renamed creds - check stubs",
        run: function (env, test) {
          // ensure new client was not created
          test.assertAnd(env.api.createClient.numCalled, 2);
          // new object was not used to send message
          test.assert(env.IRCFactory.ClientNumCalled(0), 8);
        }
      }
    ]
  });

  return suites;
});
