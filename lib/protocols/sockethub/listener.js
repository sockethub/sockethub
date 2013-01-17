var Listener = {
  redis : require('redis'),
  promising : require('promising')
};

Listener.init = function (platform) {
  this.platform = platform;
  this.channel = {
      'incoming': 'listener:'+platform+':incoming',
      'subsystem' : 'listener:'+platform+':subsystem',
      'result': 'dispatcher:result'
  };

  console.log(' [listener:'+platform+'] initializing');
  this.rc = this.redis.createClient();
  this.rc.on('error', function (err) {
    console.log(' [listener:'+platform+'] error: '+ err);
  });

  this.getJob();//this.processJob);
  this.subSystem();
  console.log(' [listener:'+platform+'] initialization complete');
};

Listener.getJob = function (processFunc) {
  console.log (' [listener:'+this.platform+'] getJob issuing BLPOP for ' + this.channel.incoming);
  var client = this.redis.createClient();
  var _this = this;
  client.blpop(this.channel.incoming, 0, function(err, replies) {
    //console.log("ERR: ",err);
    //console.log(' [listener:'+_this.platform+'] getJob() - ',replies);
    //console.log(" [listener:"+_this.platform+"]   " + i + ": " + reply);
    _this.processJob(JSON.parse(replies[1]));
    client.quit();
  });
};

Listener.processJob = function (job) {
  var _this = this;
  //console.log(' [listener:'+this.platform+'] processJob() called');
  try {
    var platform = require('./platforms/'+job.platform);
    if(! platform) {
      console.log(' [listener:' + _this.platform + '] unable to handle jobs for ' +
                  job.platform + ' platform, no platform module found in ' +
                  'lib/protocols/sockethub/platforms/');
    } else {
      var handler = platform[job.verb];
      if(! handler) {
        console.log(' [listener:' + _this.platform + '] unable to handle jobs for ' +
                    job.platform + ' platform, platform handler doesn\'t implement verb ' + job.verb);
      } else {
        var promise = this.promising();
        handler(promise, job);
        promise.then(function(result) {
          // result javascript object
          var client = _this.redis.createClient();
          client.rpush(_this.channel.result, JSON.stringify(result));
        }, function(err) {
          // something BAD happened
          console.log(' [listener:'+_this.platform+'] SOMETHING BAD HAPPENED! : '+err);
        });
      }
    }
  } catch(exc) {
    console.log(' [listener:' + _this.platform + '] failed to execute ' + exc);
  }
  this.getJob();
};

/*
 * subscribes to this platforms channel, responds to system level queries like
 * pings
 */
Listener.subSystem = function () {
  console.log (' [listener:'+this.platform+'] subscribing to ' + this.channel.subsystem);
  var client = this.redis.createClient();
  var _this = this;
  client.on("message", function (channel, message) {
    console.log(' ['+channel+'] received '+message);
    //console.log('('+_this.platform+' | '+_this.channel.subsystem);
    var data = JSON.parse(message);
    var client2 = _this.redis.createClient();
    var reply = JSON.stringify({
      verb: 'ping',
      actor: {
        platform: _this.platform,
        channel: _this.channel.subsystem
      }
    });
    console.log(' ['+channel+'] sending reply to '+data.actor.channel+' : '+reply);
    client2.publish(data.actor.channel, reply);
  });
  client.subscribe(this.channel.subsystem);
};

module.exports = Listener;