require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(['require'], function(require) {
  var suites = [];

  suites.push({
    name: "ClientManager tests",
    desc: "initialize and test the results of the ClientManager singleton",
    setup: function(env, test) {
      env.platform = 'test';
      var sessionObj = {
        platform: 'test',
        sockethubId: '12345',
        encKey: 'abcd'
      };
      var ClientManager = require('./../lib/sockethub/client-manager');
      var SessionManager = require('./../lib/sockethub/session-manager');
      var SM = new SessionManager(sessionObj);
      SM.get('abcd').then(function (session) {
        test.assertTypeAnd(session, 'object');
        env.cm1 = ClientManager(session);
        SM.get('efgh').then(function (session) {
          env.cm2 = ClientManager(session);
          SM.get('ijklm').then(function (session) {
            env.cm3 = ClientManager(session);
            test.assertType(env.cm1.get, 'function');
          });
        });
      });
    },

    tests: [
      {
        desc: 'get something that doesnt exist',
        run: function (env, test) {
          test.assert(env.cm1.get('test-client', {}), undefined);
        }
      },
      {
        desc: 'add a client with incorrect params',
        willFail: true,
        run: function (env, test) {
          try {
            env.cm1.add('test1', {
              end: function () {}
            });
            test.result(true);
          } catch (e) {
            test.result(false, e);
          }
        }
      },

      {
        desc: 'add a client with correct params (no credentials)',
        run: function (env, test) {
          try {
            env.cm1.add('test1', {
              disconnect: function () {},
              credentials: {}
            });
            test.result(true);
          } catch (e) {
            test.result(false, e);
          }
        }
      },

      {
        desc: 'fetch client without creds',
        run: function (env, test) {
          var client;
          try {
            client = env.cm1.get('test1', {});
          } catch (e) {
            test.result(false, e);
          }
          test.assertType(client, 'object');
        }
      },

      {
        desc: 'add a client with credentials',
        run: function (env, test) {
          try {
            env.cm1.add('test-client-2', {
              disconnect: function () {},
              credentials: {
                pepper: 'salt',
                ketchup: 'mustard',
                yo: [ 'one', 'two', 'three' ],
                deep: {
                  objects: 'that',
                  are: 'deep',
                  and: {
                    deeper: true
                  }
                }
              }
            });
            test.result(true);
          } catch (e) {
            test.result(false, e);
          }
        }
      },

      {
        desc: 'fetch client with creds. cm1',
        run: function (env, test) {
          try {
            var client = env.cm1.get('test-client-2', {
              pepper: 'salt',
              ketchup: 'mustard',
              yo: [ 'one', 'two', 'three' ],
              deep: {
                objects: 'that',
                are: 'deep',
                and: {
                  deeper: true
                }
              }
            });
            test.assertType(client, 'object');
          } catch (e) {
            test.result(false, e);
          }
        }
      },

      {
        desc: 'fetch client with creds. cm2',
        run: function (env, test) {
          try {
            var client = env.cm2.get('test-client-2', {
              pepper: 'salt',
              ketchup: 'mustard',
              yo: [ 'one', 'two', 'three' ],
              deep: {
                objects: 'that',
                are: 'deep',
                and: {
                  deeper: true
                }
              }
            });
            test.assertType(client, 'object');
          } catch (e) {
            test.result(false, e);
          }
        }
      },

      {
        desc: 'get count on test-client-2',
        run: function (env, test) {
          try {
            var count = env.cm1.referenceCount('test-client-2');
            console.log('COUNT: '+count);
            test.assert(count, 2);
          } catch (e) {
            test.result(false, e);
          }
        }
      },

      {
        desc: 'remove one listener',
        run: function (env, test) {
          try {
            env.cm1.remove('test-client-2');
            test.result(true);
          } catch (e) {
            test.result(false, e);
          }
        }
      },

      {
        desc: 'get count on test-client-2 again',
        run: function (env, test) {
          try {
            var count = env.cm1.referenceCount('test-client-2');
            console.log('COUNT: '+count);
            test.assert(count, 1);
          } catch (e) {
            test.result(false, e);
          }
        }
      }

    ]

  });

  return suites;
});