require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}
define(['require'], function (require) {
  var suites = [];

  suites.push({
    desc: "listeners running without dispatcher",
    abortOnFail: true,
    setup: function (env, test) {
      GLOBAL.redis = require('redis');
      env.util = require('./../lib/sockethub/util');
      env.confirmProps = {
        status: true,
        verb: 'confirm'
      };

      var port = 99550;

      env.config = {};
      env.config.HOST = {
        ENABLE_TLS: false,
        PORT: port,
        MY_PLATFORMS: [ 'rss' ] // list of platforms this instance is responsible for
      };

      env.sid = "1617171";
      env.sockethubId = 'unittests';
      env.encKey = 'enckeyblah';
      env.listener = [];
      env.job_channel = 'sockethub:'+env.sockethubId+':listener:rss:incoming';
      env.resp_channel = 'sockethub:'+env.sockethubId+':dispatcher:outgoing:'+env.sid;
      var proto = require('./../lib/sockethub/protocol');
      listener = require('./../lib/sockethub/listener');

      for (var i = 0, len = env.config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
        if (env.config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
          continue;
        }
        l  = listener();
        l.init({
          platform: proto.platforms[env.config.HOST.MY_PLATFORMS[i]],
          sockethubId: env.sockethubId,
          encKey: env.encKey
        });
        env.listener[i] = l;
      }

      test.result(true);
    },
    afterEach: function (env, test) {
      test.result(true);
    },
    takedown: function (env, test) {
      env.util.redis.clean(env.sockethubId, function () {
        test.result(true);
      });
    },
    tests: [

      /*{
        desc: "basic test",
        run: function (env, test) {
          env.util.redis.get('blpop', env.job_channel, function (err, replies) {
            console.log('RECVD rep: ', replies[1]);
            if (err) {
              test.result(false, err);
            } else {
              test.assertTypeAnd(replies[1], 'string');
              test.assert(replies[1], 'helloWorld1');
            }
          });

          var client = redis.createClient();
          client.rpush(env.job_channel, 'helloWorld1');
          //env.util.redis.set('rpush', env.job_channel, 'helloWorld1');
        }
      },*/

      {
        desc: "send job to platform with an invalid target object",
        run: function (env, test) {
          var job = {
            rid: 123,
            platform: 'rss',
            verb: 'fetch',
            actor: { address: 'johndoe'},
            object: {},
            target: { address: 'http://blog.silverbucket.net/rss'},
            sessionId: env.sid
          };

          env.util.redis.get('blpop', env.resp_channel, function (err, resp) {
            var r = JSON.parse(resp[1]);
            test.assertAnd(r.status, false);
            test.assert(r.object.message, "Error: undefined is not a valid uri or options object.");
          });
          /*var client = redis.createClient();
          client.on('ready', function() {
            console.log('CLIENT:', client);
            client.rpush(env.job_channel, JSON.stringify(job));
          });*/
          env.util.redis.set('rpush', env.job_channel, JSON.stringify(job));
        }
      },
      {
        desc: "send job to platform",
        run: function (env, test) {
          var job = {
            platform: 'rss',
            verb: 'fetch',
            actor: { address: 'johndoe'},
            object: {},
            target: [{ address: 'http://blog.silverbucket.net/rss'}],
            sessionId: env.sid
          };

          env.util.redis.set('rpush', env.job_channel, JSON.stringify(job));
          env.util.redis.get('blpop', env.resp_channel, function (err, resp) {
            var r = JSON.parse(resp[1]);
            test.assert(r.status, true);
          });
        }
      },
      {
        desc: "shutdown listener",
        run: function (env, test) {
          env.listener[0].shutdown().then(function () {
            test.result(true);
          }, function (err) {
            test.result(false, err);
          });
        }
      }

    ]
  });


/*  suites.push({
    desc: "two listeners runing with dispatcher",
    abortOnFail: true,
    setup: function (env, test) {
      //GLOBAL.redis = require('redis');
      env.util = require('./../lib/sockethub/util');

      env.confirmProps = {
        status: true,
        verb: 'confirm'
      };

      var port = 99550;

      env.config = {};
      env.config.HOST = {
        ENABLE_TLS: false,
        PORT: port,
        MY_PLATFORMS: [ 'rss' ] // list of platforms this instance is responsible for
      };
      var NUM_WORKERS = 2;
      env.sockethubId = Math.floor((Math.random()*10)+1) + new Date().getTime() / Math.floor((Math.random()*10)+2);
      env.encKey = Math.floor((Math.random()*10)+1) + new Date().getTime() / Math.floor((Math.random()*10)+2);
      env.listener = [];
      var proto = require('./../lib/sockethub/protocol');
      listener = require('./../lib/sockethub/listener');
      for (var i = 0, len = env.config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
        if (env.config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
          continue;
        }
        l  = listener();
        l.init({
          platform: proto.platforms[env.config.HOST.MY_PLATFORMS[i]],
          sockethubId: env.sockethubId,
          encKey: env.encKey
        });
        env.listener[i] = l;
      }


      env.dispatcher = require('./../lib/sockethub/dispatcher');
      env.server = {};
      dispatcher.init(env.config.HOST.MY_PLATFORMS, env.sockethubId, proto).then(function() {
        // initialize http server
        env.server.h = require('./../lib/servers/http').init(env.config);
        // initialize websocket server
        env.server.ws = require('./../lib/servers/websocket').init(env.config, env.server.h, env.dispatcher);

        console.log(' [*] finished loading' );
        console.log();
        test.result(true);
      }, function(err) {
        console.log(" [sockethub] dispatcher failed initialization, aborting");
        process.exit();
      });

    },
    tests: [

      {
        desc: "send job to platform with an invalid tagret object",
        run: function (env, test) {
          env.sid = "1617171";
          env.job_channel = 'sockethub:'+env.sockethubId+':listener:rss:incoming';
          env.resp_channel = 'sockethub:'+env.sockethubId+':dispatcher:outgoing:'+env.sid;
          var job = {
            platform: 'rss',
            verb: 'fetch',
            actor: { address: 'johndoe'},
            object: {},
            target: { address: 'http://blog.silverbucket.net/rss'},
            sessionId: env.sid
          };

          env.util.redis.set('rpush', env.job_channel, JSON.stringify(job));
          env.util.redis.get('blpop', env.resp_channel, function (err, resp) {
            var r = JSON.parse(resp[1]);
            test.assertAnd(r.status, false);
            test.assert(r.object.message, "Error: undefined is not a valid uri or options object.");
          });
        }
      },
      {
        desc: "send job to platform",
        run: function (env, test) {
          var job = {
            platform: 'rss',
            verb: 'fetch',
            actor: { address: 'johndoe'},
            object: {},
            target: [{ address: 'http://blog.silverbucket.net/rss'}],
            sessionId: env.sid
          };

          env.util.redis.set('rpush', env.job_channel, JSON.stringify(job));
          env.util.redis.get('blpop', env.resp_channel, function (err, resp) {
            var r = JSON.parse(resp[1]);
            test.assert(r.status, true);
          });
        }
      },
      {
        desc: "shutdown listener",
        run: function (env, test) {
          env.listener[0].shutdown().then(function () {
            test.result(true);
          }, function (err) {
            test.result(false, err);
          });
        }
      }

    ]
  });*/

  return suites;
});
