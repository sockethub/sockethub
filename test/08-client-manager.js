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
      env.sessionId = '12345';
      env.ClientManager = require('./../lib/sockethub/client-manager')(env.platform, env.sessionId);
      test.assertType(env.ClientManager.get, 'function');
    },

    tests: [
      {
        desc: 'get something that doesnt exist',
        run: function (env, test) {
          test.assert(env.ClientManager.get('test-client', {}), undefined);
        }
      },
      {
        desc: 'add a client with incorrect params',
        willFail: true,
        run: function (env, test) {
          try {
            env.ClientManager.add('test-client', {
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
            env.ClientManager.add('test-client', {
              end: function () {},
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
          try {
            var client = env.ClientManager.get('test-client', {});
            test.assertType(client, 'object');
          } catch (e) {
            test.result(false, e);
          }
        }
      },

      {
        desc: 'add a client with credentials',
        run: function (env, test) {
          try {
            env.ClientManager.add('test-client-2', {
              end: function () {},
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
        desc: 'fetch client with creds',
        run: function (env, test) {
          try {
            var client = env.ClientManager.get('test-client-2', {
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
      }

    ]

  });

  return suites;
});