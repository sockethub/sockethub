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

      var port = 10999;

      env.config = {
        PLATFORMS: ['rss'],
        HOST: {
          ENABLE_TLS: false,
          PORT: port,
          MY_PLATFORMS: [ 'rss' ] // list of platforms this instance is responsible for
        },
        EXAMPLES: {
          ENABLED: false
        },
        DEBUG: false,
        BASE_PATH: '../../../../'
      };

      env.sid = "1617171";
      env.sockethubId = 'unittests';
      env.encKey = 'enckeyblah';
      env.listener = [];
      env.job_channel = 'sockethub:'+env.sockethubId+':listener:rss:incoming';
      env.resp_channel = 'sockethub:'+env.sockethubId+':dispatcher:outgoing:'+env.sid;

      var config = require('./../lib/sockethub/config-loader').get(env.config);
      env.util.redis.clean(env.sockethubId).then(function () {
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
      env.util.redis.clean(env.sockethubId).then(function () {
        l.shutdown().then(function () {
          test.result(true);
        });
      });
    },
    tests: [

      {
        desc: "send bad json on job queue",
        run: function (env, test) {
          // env.util.redis.get('blpop', env.resp_channel, function (err, replies) {
          //   console.log('RECVD: ', resp[1]);
          //   var r = JSON.parse(resp[1]);
          //   test.assertAnd(r.status, false);
          //   test.assert(r.message, "invalid target array");
          //   if (err) {
          //     test.result(false, err);
          //   } else {
          //     test.assertTypeAnd(resp[1], 'string');
          //     test.assert(replies[1], 'helloWorld1');
          //   }
          // });

          env.util.redis.set('rpush', env.job_channel, 'helloWorld1');
          test.done();
        }
      },

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
        timeout: 10000,
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

  // suites.push({
  //   desc: "crashing listeners requesting encKey from dispatcher",
  //   abortOnFail: true,
  //   setup: function (env, test) {
  //     var port = 10999;
  //     env.config = {
  //       PLATFORMS: ['rss', 'dispatcher'],
  //       HOST: {
  //         ENABLE_TLS: false,
  //         PORT: port,
  //         PROTOCOLS: [ 'sockethub' ],
  //         MY_PLATFORMS: [ 'rss', 'dispatcher'], // list of platforms this instance is responsible for
  //         INIT_DISPATCHER: true
  //       },
  //       DEBUG: true,
  //       EXAMPLES: {
  //         ENABLE: false
  //       },
  //       LOG_FILE: '',
  //       BASE_PATH: '../../../../'
  //     };

  //     require('./../lib/sockethub/config-loader').clear();
  //     var config = require('./../lib/sockethub/config-loader').get(env.config);
  //     GLOBAL.redis = require('redis');
  //     env.util = require('./../lib/sockethub/util');
  //     env.confirmProps = {
  //       status: true,
  //       verb: 'confirm'
  //     };


  //     env.sid = "1617171";
  //     env.sockethubId = 'unittests';
  //     env.listener = [];
  //     env.job_channel = 'sockethub:'+env.sockethubId+':listener:rss:incoming';
  //     env.resp_channel = 'sockethub:'+env.sockethubId+':dispatcher:outgoing:'+env.sid;

  //     env.sockethub = require('./../lib/sockethub/sockethub')({
  //       root: './',
  //       debug: false,
  //       sockethubId: env.sockethubId,
  //       config: env.config
  //     });

  //     env.sockethub.events.on('initialized', function () {
  //       test.result(true);
  //     });

  //     env.proto = require('./../lib/sockethub/protocol');
  //   },
  //   beforeEach: function (env, test) {
  //     env.sockethub.sessionManager.subsystem.events.removeAllListeners();
  //     env.sockethub.sessionManager.setListeners();
  //     test.result(true);
  //   },
  //   afterEach: function (env, test) {
  //     env.sockethub.sessionManager.subsystem.send('cleanup', { sids: [ env.sid ] });
  //     setTimeout(function () {
  //       env.sockethub.sessionManager.destroy(env.sid).then(function () {
  //         test.result(true);
  //       });
  //       // env.sockethub.sessionManager.subsystem.events.removeAllListeners();
  //       // env.sockethub.sessionManager.setListeners();
  //     }, 2000);
  //   },
  //   takedown: function (env, test) {
  //     env.sockethub.shutdown();
  //     env.util.redis.clean(env.sockethubId).then(function () {
  //       test.result(true);
  //     });
  //   },
  //   tests: [

  //     {
  //       desc: "init new listener to ask for enckey",
  //       timeout: 5000,
  //       run: function (env, test) {
  //         var l = require('./../lib/sockethub/listener')({
  //           platform: env.proto.platforms['rss'],
  //           sockethubId: env.sockethubId
  //         });
  //         setTimeout(function () {
  //           console.log('LISTENER: ',l);
  //           var result = l.encKeySet();
  //           console.log('ENCKEY SET: ', result);
  //           test.assert(result, true, 'encKey not set');
  //         }, 4000);
  //       }
  //     },
  //     {
  //       desc: "init new listener to ask for enckey",
  //       timeout: 5000,
  //       run: function (env, test) {
  //         var t = require('./../lib/sockethub/listener')({
  //           platform: env.proto.platforms['rss'],
  //           sockethubId: env.sockethubId
  //         });
  //         setTimeout(function () {
  //           var result = t.encKeySet();
  //           console.log('ENCKEY SET: ', result);
  //           test.assert(result, true, 'encKey not set');
  //         }, 4000);
  //       }
  //     },
  //     {
  //       desc: "init new listener to ask for enckey",
  //       timeout: 5000,
  //       run: function (env, test) {
  //         var t = require('./../lib/sockethub/listener')({
  //           platform: env.proto.platforms['rss'],
  //           sockethubId: env.sockethubId
  //         });
  //         setTimeout(function () {
  //           var result = t.encKeySet();
  //           console.log('ENCKEY SET: ', result);
  //           test.assert(result, true, 'encKey not set');
  //         }, 4000);
  //       }
  //     },
  //     {
  //       desc: "init new listener to ask for enckey",
  //       timeout: 5000,
  //       run: function (env, test) {
  //         var t = require('./../lib/sockethub/listener')({
  //           platform: env.proto.platforms['rss'],
  //           sockethubId: env.sockethubId
  //         });
  //         setTimeout(function () {
  //           var result = t.encKeySet();
  //           console.log('ENCKEY SET: ', result);
  //           test.assert(result, true, 'encKey not set');
  //         }, 4000);
  //       }
  //     }
  //   ]
  // });



  return suites;
});
