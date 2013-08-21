#!/usr/bin/env node

var Pool = require('generic-pool').Pool;
var redis = require('redis');
var i = 0;
var pool = Pool({
  name: 'redis',
  create: function (callback){
    var client = redis.createClient();
    client.__name = "client"+i;
    i = i + 1;
    console.log('creating '+client.__name);
    client.on('error', function (err) {
      console.error('ERROR: '+err);
    });
    client.on('ready', function () {
      callback(null, client);
    });
  },
  destroy: function (client) {
    return client.quit();
  },
  max: 20,
  min: 4,
  log: true
});

function _pt() {
  pool.acquire(function (err, client) {
    if (err) {
      console.log('ERR: '+err);
    } else {
      pool.release(client);
    }
  });
}
for (var j = 0; j < 1000; j = j + 1) {
  console.log('pool test #'+j);
  _pt();
}

pool.drain(function () {
  pool.destroyAllNow();
});
