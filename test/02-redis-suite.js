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
      test.assertTypeAnd(env.util, 'object');
      env.util.redis.clean(env.sockethubId).then(function () {
        test.result(true);
      });
    },
    takedown: function (env, test) {
      env.util.redis.clean(env.sockethubId).then(function () {
        test.result(true);
      });
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
            console.log('RECVD err: ', err);
            console.log('RECVD rep: ', replies[1]);
            if (err) {
              test.result(false, err);
            } else {
              test.assertTypeAnd(replies[1], 'string');
              test.assertType(replies[1], 'string');
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
              test.assertType(replies[1], 'string');
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
              test.assertType(replies[1], 'string');
            }
          });
        }
      }

    ]
  });


  var poolTest = {
    name: "redis pool use",
    desc: "try to max out the redis pool",
    abortOnFail: true,
    setup: function (env, test) {
      var Pool = require('generic-pool').Pool;
      var redis = require('redis');
      var i = 0;
      env.pool = Pool({
        name: 'redis',
        create: function (callback){
          var client = redis.createClient();
          client.__name = "client"+i;
          i = i + 1;
          console.log('creating '+client.__name);
          client.on('error', function (err) {
            console.error('ERROR: '+err);
            //throw new SockethubError('util.redisSet failed: ' + err);
          });
          client.on('ready', function () {
            callback(null, client);
          });
        },
        destroy: function (client) {
          return client.quit();
        },
        max: 50,
        log: true
      });
      test.result(true);
    }
  };

  function _pt(env, test) {
    env.pool.acquire(function (err, client) {
      if (err) {
        console.log('ERR: '+err);
        test.result(false);
      } else {
        env.pool.release(client);
        test.result(true);
      }
    });
  }
  var poolTests = [];
  for (var j = 0; j < 800; j = j + 1) {
    poolTests[j] = {
      desc: 'pool test #'+j,
      run: _pt
    };
  }
  poolTest.tests = poolTests;
  suites.push(poolTest);

  return suites;
});
