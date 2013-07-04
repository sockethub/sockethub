var EventEmitter = require('events').EventEmitter;

var Redis = function (test) {
  return {
    createClient: function () {
      var events = new EventEmitter();
      var pub = {};
      var subscribed_channels = [];

      pub.subscribe = new test.Stub(function (channel) {
        subscribed_channels.push(channel);
      });

      pub.publish = new test.Stub(function (channel, json) {

      });

      pub.on = new test.Stub(function (event, callback) {
        events.on(event, callback);
      });

      pub.__fireEvent = function (channel, event, data, callback) {
        if (subscribed_channels.indexOf(channel) > -1) {
          if (callback) {
            events.emit(event, data, callback);
          } else {
            events.emit(event, data);
          }
        } else {
          console.log('no one subscribed to channel \''+channel+'\', not firing \''+event+'\'');
        }
      };

      return pub;
    }
  };
};

module.exports = Redis;