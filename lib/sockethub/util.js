/**
 * This file is part of sockethub.
 *
 * © 2012-2013 Nick Jennings (https://github.com/silverbucket)
 *
 * sockethub is licensed under the AGPLv3.
 * See the LICENSE file for details.
 *
 * The latest version of sockethub can be found here:
 *   git://github.com/sockethub/sockethub.git
 *
 * For more information about sockethub visit http://sockethub.org/.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

var redis = require('redis');

function SockethubError(err, exit) {
  return {
    name: "SockethubError",
    message: err,
    exit: (exit) ? exit : false,
    toString: function () {
      return this.name +": "+ this.message;
    }
  };
}

var redisWrapper = {
  check: function redisCheck(cb) {
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

  on: function(type, cb) {
    var client = redis.createClient();
    client.on(type, cb);
  },

  get: function redisSet(funcName, chan, cb) {
    var client = redis.createClient();
    function cbFunc(err, replies) {
      if ((funcName === 'brpop') && (!replies) && (typeof replies[1] === 'undefined')) {
        throw new SockethubError('util.redisGet reply is invalid: '+replies, true);
      } else {
        cb(err, replies);
        client.quit();
      }
    }

    client.on('error', function (err) {
      cbFunc(err);
    });
    client.on('ready', function () {
      client[funcName](chan, 0, cbFunc);
    });
  },

  set: function redisSet(funcName, chan, params) {
    var client = redis.createClient();
    client.on('error', function (err) {
      throw new SockethubError('util.redisSet failed: '+err);
    });
    client.on('ready', function () {
      client[funcName](chan, params);
      client.quit();
    });
  },

  single: function redisDel(funcName, key) {
    var client = redis.createClient();
    client.on('error', function (err) {
      throw new SockethubError('util.redisDel failed: '+err);
    });
    client.on('ready', function () {
      client[funcName](key);
      client.quit();
    });
  },

  clean: function redisClean(sockethubId, cb) {
    console.info(' [util] clearing redis channels');
    var channel = 'sockethub:'+sockethubId+':*';
    this.get('keys', channel, function (err, keys) {
      if ((keys) && (keys.forEach)) {
        keys.forEach(function (key, pos) {
          console.debug(' [util] deleting key ' + key);
          this.single('del', key);
        });
      } else {
        console.error(' [util] couldnt get keys list on channel \''+channel+'\': ', keys);
      }
      console.info(' [util] ready to shutdown, ', keys);
      cb(null);
    });
  }
};

module.exports = {
  redis: redisWrapper,
  SockethubError: SockethubError
};
