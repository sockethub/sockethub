require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    name: "redis tests",
    desc: "collection of basic redis tests",
    setup: function (env, test) {
      // test redis service
      env.util = require('./../lib/sockethub/util');
      test.assertType(env.util, 'object');
    },
    tests: [

      {
        desc: "verify connection",
        run: function (env, test) {
          env.util.redisCheck(function(err) {
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
          env.util.redisGet('blpop', 'test', function (err, replies) {
            if (err) {
              test.result(err);
            } else {
              test.assertTypeAnd(replies[1], 'string');
              test.assert(replies[1], 'helloWorld');
            }
          });

          env.util.redisSet('lpush', 'test', 'helloWorld');
        }
      }

    ]
  });

  return suites;
});
