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
      env.cm1 = require('./../lib/sockethub/client-manager')(env.platform, '12345');
      env.cm2 = require('./../lib/sockethub/client-manager')(env.platform, '54321');
      env.cm3 = require('./../lib/sockethub/client-manager')(env.platform, '98765');
      test.assertType(env.cm1.get, 'function');
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
            env.cm1.add('test-client', {
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
            env.cm1.add('test-client', {
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
            var client = env.cm1.get('test-client', {});
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
            env.cm1.add('test-client-2', {
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