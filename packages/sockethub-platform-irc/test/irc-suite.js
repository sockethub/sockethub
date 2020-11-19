if (typeof(define) !== 'function') {
  let define = require('amdefine')(module);
}
define(['require', 'tv4'], function (require, tv4Module) {
  let suites = [];

  suites.push({
    name: 'irc platform tests',
    desc: 'collection of tests for the irc platform',
    abortOnFail: true,
    setup: function (env, test) {
      env.Platform = require('./../index');
      env.actor = {
        '@type': 'person',
        '@id': 'testingham@irc.example.com',
        displayName:'testingham'
      };

      env.newActor = {
        '@type': 'person',
        '@id': 'testler@irc.example.com',
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
          '@id': 'irc.example.com/sockethub',
          displayName: '#sockethub'
        },
        remotestorage: {
          '@type': 'room',
          '@id': 'irc.example.com/remotestorage',
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
              topic: 'welcome to unit testing, enjoy your stay - the management'
            },
            target: env.target.sockethub
          },
          nick: {
            actor: env.actor,
            object: {
              '@type': 'address'
            },
            target: env.newActor
          }
        }
      };

      env.platform = new env.Platform({
        debug: console.log,
        updateActor: function (obj) { }
      });

      // schema
      env.schema = env.platform.schema;

      // types
      env.types = env.schema.messages.properties['@type'].enum;
      test.assertAnd(env.types, [ 'update', 'join', 'leave', 'send', 'observe', 'announce' ]);

      env.tv4 = tv4Module;

      env.platform.__connect = new test.Stub(function (key, credentials, cb) {
        cb(null, {
          end: () => {},
          on: function () {},
          raw: () => {}
        });
      });

      test.done();
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
        desc: '# join 1 channel',
        run: function (env, test) {
          env.platform.join(env.job.join.sockethub, env.credentials, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
          env.platform.__completeJob();
        }
      },
      {
        desc: '# join 1 - check stubs',
        run: function (env, test) {
          test.assert(env.platform.__connect.numCalled, 1);
        }
      },

      {
        desc: '# join 2nd channel',
        run: function (env, test) {
          env.platform.join(env.job.join.remotestorage, env.credentials, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
          env.platform.__completeJob();
        }
      },
      {
        desc: '# join 2 - check stubs',
        run: function (env, test) {
          test.assert(env.platform.__connect.numCalled, 1);
        }
      },

      {
        desc: '# send',
        run: function (env, test) {
          env.platform.send(env.job.send, env.credentials, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
          env.platform.__completeJob();
        }
      },
      {
        desc: '# send - check stubs',
        run: function (env, test) {
          test.assert(env.platform.__connect.numCalled, 1);
        }
      },

      {
        desc: '# leave',
        run: function (env, test) {
          env.platform.leave(env.job.leave, env.credentials, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
          env.platform.__completeJob();
        }
      },
      {
        desc: '# leave - check stubs',
        run: function (env, test) {
          test.assert(env.platform.__connect.numCalled, 1);
        }
      },
      {
        desc: '# check internal prop _channels',
        run: function (env, test) {
          test.assert(env.platform.__channels.has('#sockethub'), true);
        }
      },

      {
        desc: '# observe',
        run: function (env, test) {
          env.platform.observe(env.job.observe, env.credentials, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
          env.platform.__completeJob();
        }
      },
      {
        desc: '# observe - check stubs',
        run: function (env, test) {
          test.assert(env.platform.__connect.numCalled, 1);
        }
      },

      {
        desc: '# update topic',
        run: function (env, test) {
          env.platform.update(env.job.update.topic, env.credentials, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
          env.platform.__completeJob();
        }
      },
      {
        desc: '# update topic - check stubs',
        run: function (env, test) {
          test.assert(env.platform.__connect.numCalled, 1);
        }
      },

      {
        desc: '# update nick (rename)',
        run: function (env, test) {
          let called = 0;
          env.platform.update(env.job.update.nick, env.credentials, function (err, result) {
            called += 1;
            test.assertTypeAnd(err, 'undefined', err, err);
            test.assertTypeAnd(result, 'undefined');
            setTimeout(function () {
              test.assert(called, 1);
            }, 1000);
          });
          env.platform.__completeJob();
        }
      },
      {
        desc: '# update nick - check stubs',
        run: function (env, test) {
          test.assert(env.platform.__connect.numCalled, 1);
        }
      },

      {
        desc: '# join with old credentials',
        run: function (env, test) {
          env.platform.join(env.job.join.remotestorage, env.credentials, function (err, result) {
            test.assertTypeAnd(err, 'undefined', err);
            test.assertType(result, 'undefined');
          });
          env.platform.__completeJob();
        }
      }

      // {
      //   desc: '# join with old credentials makes new client (calls createClient again)',
      //   run: function (env, test) {
      //     test.assert(env.platform.__connect.numCalled, 2);
      //   }
      // },

      // {
      //   desc: '# send with renamed creds',
      //   run: function (env, test) {
      //     var job = env.job.send;
      //     job.actor = env.newActor;

      //     env.platform.send(job, env.credentials, function (err, result) {
      //       test.assertTypeAnd(err, 'undefined', err);
      //       test.assertType(result, 'undefined');
      //     });
      //   }
      // },

      // {
      //   desc: '# send with renamed creds - check stubs',
      //   run: function (env, test) {
      //     // ensure new client was not created
      //     test.assert(env.platform.__connect.numCalled, 2);
      //   }
      // }
    ]
  });

  return suites;
});
