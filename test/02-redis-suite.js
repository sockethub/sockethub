require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "redis tests",
    desc: "collection of basic redis tests",
    abortOnFail: true, // don't continue with further test suites if any tests in this suite fail
    setup: function (env, test) {
      // test redis service
      env.util = require('./../lib/sockethub/util');
      test.assertType(env.util, 'object');
    },
    tests: [

      {
        desc: "verify redis is available",
        run: function (env, test) {
          env.util.redis.check(function(err) {
            if (err) {
              test.result(false, err);
            } else {
              test.result(true);
            }
          });
        }
      },

      {
        desc: "try to push/pop",
        run: function (env, test) {
          env.util.redis.get('brpop', 'test', function (err, replies) {
            if (err) {
              test.result(false, err);
            } else {
              test.assertTypeAnd(replies[1], 'string');
              test.assert(replies[1], 'helloWorld1');
            }
          });

          env.util.redis.set('lpush', 'test', 'helloWorld1');
          env.util.redis.set('lpush', 'test', 'helloWorld2');
          env.util.redis.set('lpush', 'test', 'helloWorld3');
        }
      },

      {
        desc: "get next in list",
        run: function (env, test) {
          env.util.redis.get('brpop', 'test', function (err, replies) {
            if (err) {
              test.result(false, err);
            } else {
              test.assertTypeAnd(replies[1], 'string');
              test.assert(replies[1], 'helloWorld2');
            }
          });
        }
      },

      {
        desc: "get next in list",
        run: function (env, test) {
          env.util.redis.get('brpop', 'test', function (err, replies) {
            if (err) {
              test.result(false, err);
            } else {
              test.assertTypeAnd(replies[1], 'string');
              test.assert(replies[1], 'helloWorld3');
            }
          });
        }
      }

    ]
  });

  return suites;
});
