var Listener = {
  redis : require('redis'),
  promising : require('promising'),
  Session: require('./session')
};

Listener.init = function (platform) {
  this.platform = platform;
  this.channel = {
    'incoming': 'listener:' + platform + ':incoming',
    'subsystem': 'listener:' + platform + ':subsystem',
  };

  console.log(' [listener:' + platform + '] initializing');
  this.rc = this.redis.createClient();
  this.rc.on('error', function (err) {
    console.log(' [listener:' + platform + '] error: ' + err);
  });

  this.getJob();
  this.subSystem();
  console.log(' [listener:' + platform + '] initialization complete');
};

Listener.getJob = function (processFunc) {
  console.log (' [listener:' + this.platform + '] getJob issued for ' +
                this.channel.incoming);
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

Listener.loadPlatform = function (platform) {
  var platform_module = require('./platforms/' + platform);
  if(! platform_module) {
    console.log(' [listener:' + this.platform + '] unable to handle jobs, no ' +
                'platform module found in ' +
                'lib/protocols/sockethub/platforms/');
  }
  return platform_module;
};



Listener.processJob = function (job) {
  var _this = this;
  var session = this.Session.get(job.sessionId);
  var jobResp = session.getResponseHanqdler(job);
  //console.log(' [listener:'+this.platform+'] processJob() called');

  try {
    var platform = Listener.loadPlatform(job.platform);
    if (platform) {
      var handler = platform[job.verb];
      if(! handler) {
        console.log(' [listener:' + _this.platform +
                    '] unable to handle jobs for ' + job.platform +
                    ' platform, platform handler doesn\'t implement verb ' +
                    job.verb);
      } else {
        session.getPlatformSession(job.platform).then(function (psession) {
          handler(job, psession).then(function (err, status, obj) {
            jobResp(err, status, obj);
          });
        });
      }
    } else {
      jobResp('platform cannot handle verb '+job.verb, false);
    }
  } catch(exc) {
    console.log(' [listener:' + _this.platform + '] failed to execute ' + exc);
  }
  this.getJob();
};


/**
 * Function: cleanupPlatform
 *
 * clean up platform (call platforms cleanup function) and close
 *
 * Parameters:
 *
 *   sessionId - session id to cleanup
 *
 * Returns:
 *
 *   return description
 */
Listener.cleanupPlatform = function (sessionId) {
  var platform = Listener.loadPlatform(this.platform);
  if (typeof platform.cleanup === 'function') {
    Session.get(sessionId).then(function (session) {
      return session.getPlatformSession();
    }).then(function (psession) {
      platform.cleanup(psession);
    });
  }
  // XXX TODO FIXME: what else do we need to do during a cleanup?
  // - purge redis data
};

/*
 * subscribes to this platforms channel, responds to system level queries like
 * ping, cleanup
 */
Listener.subSystem = function () {
  console.log (' [listener:' + this.platform +
               '] subscribing to ' + this.channel.subsystem);
  var client = this.redis.createClient();
  var _this = this;
  client.on("message", function (channel, message) {
    console.log(' [listener:' + _this.platform +
                '] platform received subsystem command');
    var data = JSON.parse(message);
    var client2 = _this.redis.createClient();
    var objData = {
      ping: {
        verb: 'ping',
        platform: _this.platform,
        actor: {
          address: _this.channel.subsystem
        },
        status: true
      },
      cleanup: {
        verb: 'cleanup',
        platform: _this.platform,
        actor: {
          address: _this.channel.subsystem
        },
        status: true
      }
    };
    console.log(' [' + channel + '] sending reply to ' +
                       data.actor.channel + ' : ' + reply);

    if (data.verb === 'cleanup') {
      objData[data.verb].object = {
        sid: data.object.sid
      };
      _this.cleanupPlatform(data.object.sid);
    }
    client2.publish(data.actor.channel, objData[data.verb]);

  });
  client.subscribe(this.channel.subsystem);
};

module.exports = Listener;
