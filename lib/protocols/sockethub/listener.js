var Listener = {
  redis : require('redis'),
  platform : '',
  channel : {}
};

Listener.init = function (platform) {
  this.rc = this.redis.createClient(),

  this.platform = platform;
  this.channel.incoming = 'listener:'+platform+':incoming';
  this.channel.subsystem = 'listener:'+platform+':subsystem';

  console.log(' [listener:'+platform+'] initializing');
  this.rc.on('error', function (err) {
    console.log(' [listener:'+platform+'] error: '+ err);
  });

  //this.getJob(this.processJob);
  this.subSystem();
  console.log(' [listener:'+platform+'] initialization complete');
};

/*Listener.getJob = function (processFunc) {
  console.log (' [listener:'+this.platform+'] getJob issuing BLPOP for ' + this.channel.incoming);
  var job = this.rc.blpop(this.channel.incoming, 0);
  //processFunc(job);
};*/

//Listener.processJob = function (job) {
//  console.log (' [listener:'+this.platform+'] recevied job : ' + job);
//};

/*
 * subscribes to this platforms channel, responds to system level queries like
 * pings
 */
Listener.subSystem = function () {
  console.log (' [listener:'+this.platform+'] subscribing to ' + this.channel.subsystem);
  var client = this.redis.createClient();
  client.on("message", function (channel, message) {
    console.log(' ['+channel+'] received '+message);
    var data = JSON.parse(message);
    var client2 = this.redis.createClient();
    client2(data.actor.channel, '{"verb":"ping","actor":{"platform":"'+this.platform+'","channel":"'+this.channel.subsystem+'"}}');
  });
  client.subscribe(this.channel.subsystem);
};

module.exports = Listener;