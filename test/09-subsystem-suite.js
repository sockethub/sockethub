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
      env.platform = 'twitter';

      env.sendPing = {
        actor: {platform: env.platform},
        target: [{platform: 'dispatcher'}],
        verb: 'ping',
        object: {requestEncKey: true}
      };
      env.recvPing = {
        actor: {platform: 'dispatcher'},
        target: [{platform: env.platform}],
        verb: 'ping',
        object: {encKey: 'foobar'}
      };
      GLOBAL.redis = require('./mocks/redis-mock')(test);
      test.assertType(redis.createClient, 'function');
    },
    afterEach: function (env, test) {
      delete env.subsystem;
      delete GLOBAL.redis;
      test.result(true);
    },
    beforeEach: function (env, test) {
      GLOBAL.redis = require('./mocks/redis-mock')(test);
      env.subsystem = require('./../lib/sockethub/subsystem')(env.platform, env.sockethubId);
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
        desc: "initialize",
        run: function (env, test) {
          env.subsystem = require('./../lib/sockethub/subsystem')(env.platform, env.sockethubId);
          test.assertType(env.subsystem.send, 'function');
        }
      },
      {
        desc: "events.on exists",
        run: function (env, test) {
          test.assertType(env.subsystem.events.on, 'function');
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
        desc: "subscribe to an event and receive ping from dispatcher",
        run: function (env, test) {
          env.subsystem.events.on('ping', function (data) {
            test.assert(data, env.recvPing);
          });
          redis.__fireEvent(env.channel, 'message', JSON.stringify(env.recvPing));
        }
      },
      {
        desc: "send ping and wait for callback as dispatcher",
        run: function (env, test) {
          var subsystem = require('./../lib/sockethub/subsystem')('dispatcher', env.sockethubId);

          subsystem.events.on('ping', function (data) {
            test.assert(data, env.sendPing);
          });
          redis.__fireEvent(env.channel, 'message', JSON.stringify(env.sendPing));
        }
      },
      {
        desc: "send ping and wait for callback as dispatcher, then respond",
        run: function (env, test) {
          var subsystem = require('./../lib/sockethub/subsystem')('dispatcher', env.sockethubId);

          env.subsystem.events.on('ping-response', function (data) {
            console.log('HELLO: ', data);
            test.assertAnd(data, env.recvPing);
          });
          subsystem.events.on('ping-with-callback', function (data, callback) {
            test.assertAnd(data, env.sendPing);
            callback(env.recvPing.object);
          });
          redis.__fireEvent(env.channel, 'message', JSON.stringify(env.sendPing));
        }
      }

    ]
  });

  return suites;
});

