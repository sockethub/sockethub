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

      env.util.redis.clean(env.sockethubId, function () {
        test.result(true);
      });
    },
    beforeEach: function (env, test) {
      var proto = require('./../lib/sockethub/protocol');
      var listener = require('./../lib/sockethub/listener');
      for (var i = 0, len = env.config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
        if (env.config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
          continue;
        }
        l = listener({
          platform: proto.platforms[env.config.HOST.MY_PLATFORMS[i]],
          sockethubId: env.sockethubId,
          encKey: env.encKey
        });
        env.listener[i] = l;
      }
      test.result(true);
    },
    afterEach: function (env, test) {
      l.shutdown().then(function () {
        test.result(true);
      });
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
        desc: "send job to platform with an invalid target object - FAILS",
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
            console.log('received: '+resp[1]);
            test.assertAnd(r.status, false);
            test.assert(r.message, "invalid target array");
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
            //console.log("GOT RESP: ", resp);
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

  suites.push({
    desc: "crashing listeners requesting encKey from dispatcher",
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
      env.listener = [];
      env.job_channel = 'sockethub:'+env.sockethubId+':listener:rss:incoming';
      env.resp_channel = 'sockethub:'+env.sockethubId+':dispatcher:outgoing:'+env.sid;
      env.proto = require('./../lib/sockethub/protocol');
      listener = require('./../lib/sockethub/listener');

      for (var i = 0, len = env.config.HOST.MY_PLATFORMS.length; i < len; i = i + 1) {
        if (env.config.HOST.MY_PLATFORMS[i] === 'dispatcher') {
          continue;
        }
        l  = listener({
          platform: env.proto.platforms[env.config.HOST.MY_PLATFORMS[i]],
          sockethubId: env.sockethubId
        });
        env.listener[i] = l;
      }

      env.dispatcher = require('./../lib/sockethub/dispatcher');

      env.server = {};
      env.dispatcher.init(env.config.HOST.MY_PLATFORMS, env.sockethubId, env.proto).then(function() {
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

      test.result(true);
    },
    afterEach: function (env, test) {
      env.dispatcher.sessionManager.subsystem.send('cleanup', { sids: [ env.sid ] });
      setTimeout(function () {
        env.dispatcher.sessionManager.destroy(env.sid).then(function () {
          test.result(true);
        });
      }, 2000);
    },
    beforeEach: function (env, test) {
      env.dispatcher.sessionManager.get(env.sid).then(function(session) {
        test.result(true);
      });
    },
    takedown: function (env, test) {
      env.util.redis.clean(env.sockethubId, function () {
        test.result(true);
      });
    },
    tests: [

      {
        desc: "init new listener to ask for enckey",
        timeout: 5000,
        run: function (env, test) {
          var l = require('./../lib/sockethub/listener')({
            platform: env.proto.platforms['rss'],
            sockethubId: env.sockethubId
          });
          setTimeout(function () {
            console.log('LISTENER: ',l);
            var result = l.encKeySet();
            console.log('ENCKEY SET: ', result);
            test.assert(result, true, 'encKey not set');
          }, 4000);
        }
      },
      {
        desc: "init new listener to ask for enckey",
        timeout: 5000,
        run: function (env, test) {
          var t = require('./../lib/sockethub/listener')({
            platform: env.proto.platforms['rss'],
            sockethubId: env.sockethubId
          });
          setTimeout(function () {
            var result = t.encKeySet();
            console.log('ENCKEY SET: ', result);
            test.assert(result, true, 'encKey not set');
          }, 4000);
        }
      },
      {
        desc: "init new listener to ask for enckey",
        timeout: 5000,
        run: function (env, test) {
          var t = require('./../lib/sockethub/listener')({
            platform: env.proto.platforms['rss'],
            sockethubId: env.sockethubId
          });
          setTimeout(function () {
            var result = t.encKeySet();
            console.log('ENCKEY SET: ', result);
            test.assert(result, true, 'encKey not set');
          }, 4000);
        }
      },
      {
        desc: "init new listener to ask for enckey",
        timeout: 5000,
        run: function (env, test) {
          var t = require('./../lib/sockethub/listener')({
            platform: env.proto.platforms['rss'],
            sockethubId: env.sockethubId
          });
          setTimeout(function () {
            var result = t.encKeySet();
            console.log('ENCKEY SET: ', result);
            test.assert(result, true, 'encKey not set');
          }, 4000);
        }
      }


    ]
  });



  return suites;
});
