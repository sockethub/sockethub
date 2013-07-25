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
var promising = require('promising');
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
  create: function (callback){
    var client = redis.createClient();
    client.on('error', function (err) {
      console.error('ERROR: '+err);
      //throw new SockethubError('util.redisSet failed: ' + err);
    });
    client.on('ready', function () {
      //client.send_anyway = true;
      //client.select(database);
      //client.send_anyway = false;
      callback(null, client);
    });
  },
  destroy: function (client) {
    return client.quit();
  },
  max: 50,
  min: 2,
  idleTimeoutMillis: 10000,
  reapIntervalMillis: 1000,
  log: false
});

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
      client.quit();
    }
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
        if ((funcName === 'brpop') && (!replies) && (typeof replies[1] === 'undefined')) {
          throw new Error('util.redisGet reply is invalid: '+replies);
        } else {
          //console.debug(funcName + ' received: ', replies);
          cb(err, replies);
        }
        pool.release(client);
      });
    });
  },

  set: function redisSet(funcName, chan, data) {
    //console.log('*** SET called: ' + funcName + ' ' + chan);
    pool.acquire(function (err, client) {
      //console.log('--- ' + funcName + ' ID: '+client.__name+' to chan ' + chan);
      client[funcName](chan, data, function (err, reply) {
        /*if (err) {
            console.log("===== Error: " + err);
        } else {
            console.log("===== Reply: " + reply);
        }*/
        pool.release(client);
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

  clean: function redisClean(sockethubId, cb) {
    console.info(' [util] clearing redis channels');
    var channel = 'sockethub:'+sockethubId+':*';
    var client = redis.createClient();
    var _this = this;

    client.keys(channel, function (err, keys) {
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
        console.info(' [util] ready to shutdown');
      }
      //ClientManager.close().then(function () {
        cb(null);
      //});
    });
  }
};

module.exports = {
  redis: redisWrapper,
  SockethubError: SockethubError
};
