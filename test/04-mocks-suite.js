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
      var client = redis.createClient();
      test.assertType(client.__fireEvent, 'function');
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
      }
    ]
  });
  return suites;
});