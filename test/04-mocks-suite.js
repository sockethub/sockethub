require("consoleplusplus/console++");
if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

define(['require'], function(require) {
  var suites = [];
  var redis;

  suites.push({
    desc: "initialize redis stub/mock",
    setup: function(env, test) {
      redis = require('./mocks/redis-mock')(test);
      console.log('redis: ', redis);
      var client = redis.createClient();
      test.assertType(client.__fireEvent, 'function');
    },
    afterEach: function (env, test) {
      redis.__clearHandlers();
      test.result(true);
    },
    tests: [
      {
        desc: 'publish is called',
        run: function (env, test) {
          var client = redis.createClient();
          client.publish('message');
          test.assert(client.publish.called, true);
        }
      },
      {
        desc: 'subscribe is called',
        run: function (env, test) {
          var client = redis.createClient();
          client.subscribe('message');
          test.assert(client.subscribe.called, true);
        }
      },
      {
        desc: 'on is called',
        run: function (env, test) {
          var client = redis.createClient();
          client.on('message', function () {});
          test.assert(client.on.called, true);
        }
      },
      {
        desc: 'force fire events',
        run: function (env, test) {
          var client = redis.createClient();
          client.subscribe('message');

          client.on('message', function (channel, data) {
            console.log('message event received, data: ', data);
            test.assertTypeAnd(data, 'string', 'no string');
            var d = JSON.parse(data);
            test.assert(d.foo, 'bar', 'no bar');
          });

          var client2 = redis.createClient();
          client2.publish('message', JSON.stringify({foo: 'bar'}));
          client.__fireEvent('message', 'message', JSON.stringify({foo: 'bar'}));
        }
      },
      {
        desc: 'force fire events for several listener instances',
        run: function (env, test) {
          var reg = {
            '0': false,
            '1': false,
            '2': false,
            '3': false
          };

          var client = redis.createClient();
          client.subscribe('test:channel');
          client.on('message', function (channel, data) {
            console.log('client message event received, data: ', data);
            test.assertTypeAnd(data, 'string', 'no string');
            var d = JSON.parse(data);
            test.assertAnd(d.foo, 'bar', 'no bar');
            reg['0'] = true;
          });

          var client1 = redis.createClient();
          client1.subscribe('test:channel');
          client1.on('message', function (channel, data) {
            console.log('client1 message event received, data: ', data);
            test.assertTypeAnd(data, 'string', 'no string');
            var d = JSON.parse(data);
            test.assertAnd(d.foo, 'bar', 'no bar');
            reg['1'] = true;
          });

          var client2 = redis.createClient();
          client2.subscribe('test:channel');
          client2.on('message', function (channel, data) {
            console.log('client2 message event received, data: ', data);
            test.assertTypeAnd(data, 'string', 'no string');
            var d = JSON.parse(data);
            test.assertAnd(d.foo, 'bar', 'no bar');
            reg['2'] = true;
          });

          var client3 = redis.createClient();
          client3.subscribe('test:channel');
          client3.on('message', function (channel, data) {
            console.log('client3 message event received, data: ', data);
            test.assertTypeAnd(data, 'string', 'no string');
            var d = JSON.parse(data);
            test.assertAnd(d.foo, 'bar', 'no bar');
            reg['3'] = true;
          });


          var count = 0;
          for (var key in redis.__instances) {
            console.log(key+' subscribed channels:'+redis.__instances[key].subscribed_channels.length);
            test.assertAnd(redis.__instances[key].subscribed_channels.length, 1, key+': subscribers:'+redis.__instances[key].subscribed_channels.length);
            count = count + 1;
          }
          test.assert(count, 4, 'count not 4');

          var client4 = redis.createClient();
          client4.publish('test:channel', JSON.stringify({foo: 'bar'}));
          //redis.__fireEvent('test:channel', 'message', JSON.stringify({foo: 'bar'}));
          setTimeout(function () {
            for (var key in reg) {
              if (!reg[key]) {
                test.result(false, 'reg['+key+'] false');
              }
            }
          }, 2000);
        }
      }
    ]
  });
  return suites;
});