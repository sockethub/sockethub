require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(['require'], function(require) {
  var suites = [];

  suites.push({
    desc: "subsystem tests",
    setup: function(env, test) {
      env.sockethubId = '1234567890';
      env.channel = 'sockethub:'+env.sockethubId+':subsystem';
      env.twitter = {};
      env.dispatcher = {};

      env.pingObj = {
        twitter: {
          send:{
            actor: {platform: 'twitter'},
            target: [{platform: 'dispatcher'}],
            verb: 'ping',
            object: {requestEncKey: true}
          },
          recv: {
            actor: {platform: 'dispatcher'},
            target: [{platform: 'twitter'}],
            verb: 'ping',
            object: {encKey: 'foobar'},
            status: true
          }
        },
        dispatcher: {
          send: {
            actor: {platform: 'dispatcher'},
            target: [{platform: 'twitter'}],
            verb: 'ping',
            object: {requestEncKey: true}
          },
          recv: {
            actor: {platform: 'twitter'},
            target: [{platform: 'dispatcher'}],
            verb: 'ping',
            object: {encKey: 'foobar'},
            status: true
          }
        }
      };

      env.pingObj.recvPing = {

      };
      GLOBAL.redis = require('./mocks/redis-mock')(test);
      test.assertType(redis.createClient, 'function');
    },
    afterEach: function (env, test) {
      redis.__clearHandlers();
      delete env.twitter.subsystem;
      delete env.dispatcher.subsystem;
      delete GLOBAL.redis;
      test.result(true);
    },
    beforeEach: function (env, test) {
      GLOBAL.redis = require('./mocks/redis-mock')(test);
      env.twitter.subsystem = require('./../lib/sockethub/subsystem')('twitter', env.sockethubId);
      env.dispatcher.subsystem = require('./../lib/sockethub/subsystem')('dispatcher', env.sockethubId);
      test.assertTypeAnd(env.twitter.subsystem.send, 'function');
      test.assertType(redis.createClient, 'function');
    },
    tests: [
      {
        desc: "verify subsystem will fail to init without all params",
        willFail: true,
        run: function (env, test) {
          var Subsystem = require('./../lib/sockethub/subsystem')(env.sockethubId);
          test.result(true);
        }
      },
      {
        desc: "events.on exists",
        run: function (env, test) {
          test.assertType(env.twitter.subsystem.events.on, 'function');
        }
      },
      {
        desc: "createClient should have been called",
        run: function (env, test) {
          console.log('num:', redis.createClient.numCalled);
          test.assert(redis.createClient.called, true);
        }
      },
      {
        desc: "subscribe to an event and receive ping from dispatcher (autocallback)",
        run: function (env, test) {
          env.twitter.subsystem.events.on('ping', function (data) {
            console.log('#----------1:', data);
            test.assertAnd(data.actor.platform, 'dispatcher');
            test.assert(data.target[0].platform, 'twitter');
          });
          redis.__fireEvent(env.channel, 'message', JSON.stringify(env.pingObj.dispatcher.send));
        }
      },
      {
        desc: "subscribe to an event and receive ping from dispatcher (with-callback)",
        run: function (env, test) {
          env.twitter.subsystem.events.on('ping-with-callback', function (data, callback) {
            console.log('@----------1:', data);
            test.assertAnd(data.actor.platform, 'dispatcher');
            test.assertAnd(data.target[0].platform, 'twitter');
            callback();
            test.result(true);
          });
          console.log('ACTOR:', env.pingObj.dispatcher.send.actor.platform);
          console.log('TARGET:', env.pingObj.dispatcher.send.target[0].platform);
          redis.__fireEvent(env.channel, 'message', JSON.stringify(env.pingObj.dispatcher.send));
        }
      },
      {
        desc: "send ping and wait for callback as dispatcher",
        run: function (env, test) {
          //env.dispatcher.subsystem = require('./../lib/sockethub/subsystem')('dispatcher', env.sockethubId);
          env.dispatcher.subsystem.events.on('ping', function (data) {
            //console.log('----------1:', data);
            test.assert(data.target[0].platform, 'dispatcher');
          });

          console.log('target:',env.pingObj.twitter.send.target[0].platform);
          test.assertAnd(env.pingObj.twitter.send.target[0].platform, 'dispatcher', 'target = dispatcher');
          test.assertAnd(env.pingObj.twitter.send.actor.platform, 'twitter', 'actor = twitter');
          redis.__fireEvent(env.channel, 'message', JSON.stringify(env.pingObj.twitter.send));
        }
      },
      {
        desc: "send ping and wait for callback as dispatcher, then respond",
        run: function (env, test) {
          //dispatcher.subsystem = require('./../lib/sockethub/subsystem')('dispatcher', env.sockethubId);
          env.twitter.subsystem.events.on('ping-response', function (data) {
            console.log('+++ 1');
            test.assertAnd(data.target[0].platform, 'twitter');
            env.pingObj.twitter.recv.object.timestamp = data.object.timestamp;
            test.assert(data, env.pingObj.twitter.recv);
          });

          env.dispatcher.subsystem.events.on('ping-with-callback', function (data, callback) {
            console.log('+++ 2:',data);
            test.assertAnd(data.actor.platform, 'twitter');
            test.assertTypeAnd(callback, 'function');
            callback({encKey: 'foobar'});
          });

          redis.__fireEvent(env.channel, 'message', JSON.stringify(env.pingObj.twitter.send));
        }
      }

    ]
  });

  return suites;
});

