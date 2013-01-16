var Listener = {
  redis : require('redis'),
  platform : '',
  channel : {}
};

Listener.init = function (platform) {
  this.rc = this.redis.createClient(),

  this.platform = platform;
  this.channel.incoming = platform+':incoming';

  console.log(' [listener:'+platform+'] initializing');
  this.rc.on('error', function (err) {
    console.log(' [listener:'+platform+'] error: '+ err);
  });

  this.getJob(this.processJob);
};

Listener.getJob = function (processFunc) {
  var job = this.rc.blpop(this.platform+':incoming', 0);
  processFunc(job);
};

Listener.processJob = function (job) {
  console.log (' [listener:'+this.platform+'] recevied job : ' + job);
};

module.exports = Listener;