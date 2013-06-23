var redis = require('redis');
module.exports = {
  redisGet: function redisConnect(funcName, chan, cb) {
    var client = redis.createClient();
    function cbFunc(err, replies) {
      cb(err, replies);
      client.quit();
    }

    client.on('ready', function () {
      client[funcName](chan, 0, cbFunc);
    });
  },
  redisSet: function redisConnect(funcName, chan, params) {
    var client = redis.createClient();
    client.on('ready', function () {
      client[funcName](chan, params);
      client.quit();
    });
  },
  SockethubError: function SockethubError(err, exit) {
    return {
      name: "ScokethubError",
      message: err,
      exit: (exit) ? exit : false,
      toString: function () {
        return this.name +": "+ this.message;
      }
    };
  }
};