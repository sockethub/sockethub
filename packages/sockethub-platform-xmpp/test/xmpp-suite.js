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
      env.SimpleXMPP = require('./mock-simple-xmpp')(test);
      env.SimpleXMPP.mock = true;
      global.SimpleXMPP = env.SimpleXMPP;
      global.xmpp = env.SimpleXMPP.xmpp();
      env.xmpp = env.SimpleXMPP.xmpp();

      var Platform = require('./../index');
      env.platform = new Platform(env.session);

      env.actor = {
        '@type': 'person',
        '@id': 'xmpp://testingham@jabber.net',
        displayName:'testingham'
      };

      env.newActor = {
        '@type': 'person',
        '@id': 'xmpp://testler@jabber.net',
        displayName:'testler'
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
          '@id': 'xmpp://jabber.net/mrfoobar',
          displayName: 'Mr FooBar'
        }
      };

      env.job = {
        // join: {
        //   sockethub: {
        //     actor: env.actor,
        //     target: env.target.sockethub
        //   },
        //   remotestorage: {
        //     actor: env.actor,
        //     target: env.target.remotestorage
        //   }
        // },
        send: {
          actor: env.actor,
          object: {
            '@type': 'message',
            content: 'hello'
          },
          target: env.target.mrfoobar
        },
        // observe: {
        //   actor: env.actor,
        //   object: {
        //     '@type': 'attendance'
        //   },
        //   target: env.target.mrfoobar
        // },
        update: {
          // topic: {
          //   actor: env.actor,
          //   object: {
          //     '@type': 'topic',
          //     topic: 'welcome to unit testing, enjoy your stay - the management'
          //   },
          //   target: env.target.sockethub
          // },
          // nick: {
          //   actor: env.actor,
          //   target: env.newActor
          // }
          presence: {
            actor: env.actor,
            object: {
              '@type': 'presence',
              presence: 'available',
              status: 'available'
            }
          }
        }
      };

      // schema
      env.schema = env.platform.schema;

      // types
      env.types = env.schema.messages.properties['@type'].enum;
      test.assertAnd(env.types.sort(), [ 'update', 'make-friend', 'send', 'remove-friend', 'request-friend' ].sort());

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

      // {
      //   desc: "# join 1 channel",
      //   run: function (env, test) {
      //     env.platform.join(env.job.join.sockethub, function (err, result) {
      //       test.assertTypeAnd(err, 'undefined', err);
      //       test.assertType(result, 'undefined');
      //     });
      //   }
      // },
      // {
      //   desc: "# join 1 - check stubs",
      //   run: function (env, test) {
      //     test.assertAnd(env.xmpp.connect.numCalled, 1);
      //     test.assert(env.SimpleXMPP.ClientNumCalled(0), 1); // #sockethub
      //   }
      // },

      // {
      //   desc: "# join 2nd channel",
      //   run: function (env, test) {
      //     env.platform.join(env.job.join.remotestorage, function (err, result) {
      //       test.assertTypeAnd(err, 'undefined', err);
      //       test.assertType(result, 'undefined');
      //     });
      //   }
      // },
      // {
      //   desc: "# join 2 - check stubs",
      //   run: function (env, test) {
      //     test.assertAnd(env.api.connect.numCalled, 1);
      //     test.assert(env.SimpleXMPP.ClientNumCalled(0), 2); // #remotestorage
      //   }
      // },

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
          test.assertAnd(env.xmpp.send.numCalled, 2);
          test.assert(env.SimpleXMPP.ClientNumCalled(0), 0);
        }
      },

      // {
      //   desc: "# leave",
      //   run: function (env, test) {
      //     env.platform.leave(env.job.leave, function (err, result) {
      //       test.assertTypeAnd(err, 'undefined', err);
      //       test.assertType(result, 'undefined');
      //     });
      //   }
      // },
      // {
      //   desc: "# leave - check stubs",
      //   run: function (env, test) {
      //     test.assertAnd(env.api.connect.numCalled, 1);
      //     test.assert(env.SimpleXMPP.ClientNumCalled(0), 4); // #remotestorage
      //   }
      // },
      // {
      //   desc: "# check internal prop _channels",
      //   run: function (env, test) {
      //     test.assert(env.platform._channels, ['#sockethub']);
      //   }
      // },

      // {
      //   desc: "# observe",
      //   run: function (env, test) {
      //     env.platform.observe(env.job.observe, function (err, result) {
      //       test.assertTypeAnd(err, 'undefined', err);
      //       test.assertType(result, 'undefined');
      //     });
      //   }
      // },
      // {
      //   desc: "# observe - check stubs",
      //   run: function (env, test) {
      //     test.assertAnd(env.api.connect.numCalled, 1);
      //     test.assert(env.SimpleXMPP.ClientNumCalled(0), 5); // #sockethub
      //   }
      // },

      // {
      //   desc: "# update topic",
      //   run: function (env, test) {
      //     env.platform.update(env.job.update.topic, function (err, result) {
      //       test.assertTypeAnd(err, 'undefined', err);
      //       test.assertType(result, 'undefined');
      //     });
      //   }
      // },
      // {
      //   desc: "# update topic - check stubs",
      //   run: function (env, test) {
      //     test.assertAnd(env.api.connect.numCalled, 1);
      //     test.assert(env.SimpleXMPP.ClientNumCalled(0), 6); // #sockethub
      //   }
      // },

      // {
      //   desc: "# update nick (rename)",
      //   run: function (env, test) {
      //     var called = 0;
      //     env.platform.update(env.job.update.nick, function (err, result) {
      //       called += 1;
      //       test.assertTypeAnd(err, 'undefined', err, err);
      //       test.assertTypeAnd(result, 'undefined');
      //       setTimeout(function () {
      //         test.assert(called, 1);
      //       }, 1000);
      //     });
      //   }
      // },
      // {
      //   desc: "# update nick - check stubs",
      //   run: function (env, test) {
      //     test.assertAnd(env.api.connect.numCalled, 1);
      //     test.assert(env.SimpleXMPP.ClientNumCalled(0), 7);
      //   }
      // },

      {
        desc: "# update presence",
        run: function (env, test) {
          env.platform.update(env.job.update.presence, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# update topic - check stubs",
        run: function (env, test) {
          test.assertAnd(env.xmpp.setPresence.numCalled, 1);
          test.assert(env.SimpleXMPP.ClientNumCalled(0), 6); // #sockethub
        }
      },

      {
        desc: "# send with old credentials",
        run: function (env, test) {
          env.platform.senf(env.job.send.remotestorage, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
        }
      },
      {
        desc: "# send with old credentials makes new client (calls createClient again)",
        run: function (env, test) {
          test.assertAnd(env.api.connect.numCalled, 2);
          test.assert(env.SimpleXMPP.ClientNumCalled(1), 1); // #sockethub
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
          test.assertAnd(env.api.connect.numCalled, 2);
          // new object was not used to send message
          test.assert(env.SimpleXMPP.ClientNumCalled(0), 8);
        }
      }
    ]
  });

  return suites;
});
