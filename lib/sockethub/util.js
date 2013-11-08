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
var Q = require('q');
var Pool = require('generic-pool').Pool;


function SockethubError(err, exit) {
  return {
    name: "SockethubError",
    message: err,
    stack: err.stack,
    exit: (exit) ? exit : false,
    toString: function () {
      return this.name +": "+ this.message;
    }
  };
}

/**
 * Function: RedisPool
 *
 * get - returns a promise which is fulfilled when a redis client is ready for
 * orders. queues up requests until the client is ready
 *
 */
var i = 0;
var pool = Pool({
  name: 'redis',
  create: function (callback) {
    var config = require('./config-loader').get();
    var client = redis.createClient(config.REDIS.PORT, config.REDIS.HOST);
    client.__name = "client"+i;
    i = i + 1;
    client.on('error', function (err) {
      console.error('ERROR: '+err);
      //throw new SockethubError('util.redisSet failed: ' + err);
    });
    client.on('ready', function () {
      callback(null, client);
    });
  },
  destroy: function (client) {
    return client.quit();
  },
  max: 60,
  log: false
});

var redisWrapper = {
  check: function redisCheck() {
    var q = Q.defer();
    var config = require('./config-loader').get();
    console.info(" [util] checking redis connection at "+config.REDIS.HOST+':'+config.REDIS.PORT);
    var client = redis.createClient(config.REDIS.PORT, config.REDIS.HOST);
    try {
      client.on('error', function (err) {
        client.quit();
        q.reject(err);
      });
      client.on('ready', function () {
        //console.log('redis version: '+client.server_info.redis_version);
        var v = client.server_info.versions;
        if (v[0] < 2) {
          q.reject("Sockethub requires redis version 2.x or above for the brpop command. " +
             "Current redis version "+ client.server_info.redis_version);
        } else {
          q.resolve(client.server_info.redis_version);
        }
        client.quit();
      });
    } catch (e) {
      q.reject('cannot connect to redis: ' + e);
      client.quit();
    }
    return q.promise;
  },

  on: function(type, cb) {
    client = redis.createClient();
    client.on(type, cb);
  },

  get: function redisSet(funcName, chan, cb) {
    //console.log('*** GET called: ' + funcName + ' ' + chan);
    pool.acquire(function (err, client) {
      //console.log('--- ' + funcName + ' ID: '+client.__name+' to chan ' + chan);
      client[funcName](chan, 0, function (err, replies) {
        pool.release(client);
        if ((funcName === 'brpop') && ((!replies) || (typeof replies[1] === 'undefined'))) {
          console.error('util.redisGet got a bad reply: ', replies);
          cb('got bad reply from redis', []);
          //throw new Error('util.redisGet reply is invalid: '+replies);
        } else {
          //console.debug(funcName + ' received: ', replies);
          cb(err, replies);
        }
      });
    });
  },

  set: function redisSet(funcName, chan, data) {
    //console.log('*** SET called: ' + funcName + ' ' + chan);
    pool.acquire(function (err, client) {
      //console.log('--- ' + funcName + ' ID: '+client.__name+' to chan ' + chan);
      client[funcName](chan, data, function (err, reply) {
        pool.release(client);
        if (err) {
            console.error(" [util] set error: " + err);
        }
      });
    });
  },

  single: function redisDel(funcName, key) {
    pool.acquire(function (err, client) {
      client[funcName](key, function () {
        pool.release(client);
      });
    });
  },

  clean: function redisClean(sockethubId) {
    console.debug(' [util] clearing redis channels');
    var channel = 'sockethub:'+sockethubId+':*';
    var client = redis.createClient();
    var _this = this;
    var q = Q.defer();

    client.keys(channel, function (err, keys) {
      client.quit();
      console.debug(' [util] keys ', keys);
      if ((keys) && (keys.forEach)) {
        keys.forEach(function (key, pos) {
          console.debug(' [util] deleting key ' + key);
          _this.single('del', key);
        });
      } else {
        console.error(' [util] couldnt get keys list on channel \''+channel+'\': ', keys);
      }
      if (err) {
        console.error(' [util] failed clearing redis queue. '+err);
      } else {
        console.debug(' [util] ready to shutdown');
      }
      //cb(null);
      q.resolve();
    });

    /*pool.drain(function () {
      pool.destroyAllNow();
    });*/
    return q.promise;
  }
};

module.exports = {
  redis: redisWrapper,
  SockethubError: SockethubError
};
