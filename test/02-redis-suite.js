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
      config = require('./../lib/sockethub/config-loader').get(undefined, undefined, {
        HOST: {
          ENABLE_TLS: false,
          PORT: '10999',
          PROTOCOLS: [ 'sockethub' ]
        },
        EXAMPLES: {
          ENABLE: false
        },
        DEBUG: true,
        LOG_FILE: '',
        BASE_PATH: '../../../../'
      });
      env.redisPool = require('redis-connection-pool')();
      test.assertTypeAnd(env.redisPool, 'object');
      env.redisPool.clean('sockethub:'+env.sockethubId+':*', function () {
        test.result(true);
      });
    },
    takedown: function (env, test) {
      env.redisPool.clean('sockethub:'+env.sockethubId+':*', function () {
        test.result(true);
      });
      require('./../lib/sockethub/config-loader').clear();
      delete env.redisPool;
    },
    tests: [

      {
        desc: "verify redis is available",
        run: function (env, test) {
          env.redisPool.check().then(function() {
            test.result(true);
          }, function (err) {
            test.result(true, err);
          });
        }
      },

      {
        desc: "try to push/pop",
        run: function (env, test) {
          env.redisPool.brpop('test', function (err, replies) {
            console.log('RECVD err: ', err);
            console.log('RECVD rep: ', replies[1]);
            if (err) {
              test.result(false, err);
            } else {
              test.assertTypeAnd(replies[1], 'string');
              test.assertType(replies[1], 'string');
            }
          });

          env.redisPool.lpush('test', 'helloWorld1');
          env.redisPool.lpush('test', 'helloWorld2');
          env.redisPool.lpush('test', 'helloWorld3');
        }
      },

      {
        desc: "get next in list",
        run: function (env, test) {
          env.redisPool.brpop('test', function (err, replies) {
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
          env.redisPool.brpop('test', function (err, replies) {
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
