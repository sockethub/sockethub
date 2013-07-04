var instances = {};

var Redis = function (test) {
  return {
    createClient: new test.Stub(function () {
      var me = Math.floor((Math.random()*10)+1) + new Date().getTime();
      instances[me] = {};
      instances[me].subscribed_channels = [];
      var events = {
        'message': [],
        'error': []
      };

      instances[me].subscribe = new test.Stub(function (channel) {
        console.log('instance['+me+'] subscribing to: '+channel);
        instances[me].subscribed_channels.push(channel);
      });

      instances[me].publish = new test.Stub(function (channel, json) {
        instances[me].__fireEvent(channel, 'message', json);
      });

      instances[me].on = new test.Stub(function (event, callback) {
        console.log('instance['+me+'] registering callback for \''+event+'\'');
        events[event].push(callback);
      });

      instances[me].__fireEvent = function (channel, event, data) {
        if (instances[me].subscribed_channels.indexOf(channel) > -1) {
          console.log('instance['+me+'] sub. to chan. \''+channel+'\', send: \''+event+'\': '+data);
          for (var i = 0, num = events[event].length; i < num; i = i + 1) {
            events[event][i](channel, data);
          }
        } else {
          console.log('instance['+me+'] not subscribed to channel \''+channel+'\', not firing \''+event+'\'', instances[me].subscribed_channels);
        }
      };

      return instances[me];
    }),
    __fireEvent: function (channel, event, data) {
      for (var key in instances) {
        instances[key].__fireEvent(channel, event, data);
      }
    }
  };
};

module.exports = Redis;