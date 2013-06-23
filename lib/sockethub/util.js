var redis = require('redis');

module.exports = {

  redisCheck: function redisCheck(cb) {
    var client = redis.createClient();



    try {
      client.on('error', function (err) {
        cb(err);
        client.quit();
      });
      client.on('ready', function () {
        console.log('redis version: '+client.server_info.redis_version);
        var v = client.server_info.versions;
        if (v[0] < 2) {
          cb("Sockethub requires redis version 2.x or above for the brpop command. " +
             "Current redis version "+ client.server_info.redis_version);
        } else {
          cb(null);
        }
        client.quit();
      });
    } catch (e) {
      cb('cannot connect to redis: ' + e);
    }
  },

  redisGet: function redisSet(funcName, chan, cb) {
    var client = redis.createClient();
    function cbFunc(err, replies) {
      cb(err, replies);
      client.quit();
    }

    client.on('error', function (err) {
      cbFunc(err);
    });
    client.on('ready', function () {
      client[funcName](chan, 0, cbFunc);
    });
  },

  redisSet: function redisSet(funcName, chan, params) {
    var client = redis.createClient();
    client.on('error', function (err) {
      throw('util.redisSet failed: '+err);
    });
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
