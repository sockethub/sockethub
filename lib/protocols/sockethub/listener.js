/**
 * Variable: Listener
 *
 * There is one listener per platform. Upon initialization it subscribes to the
 * incoming redis channel for it's platform
 * (sockethub:listener:email:incoming), as well as the subsystem redis
 * channel for it's platform (sockethub:listener:email:subsystem).
 *
 * It will then reqiure the platform module and finally it waits for incoming
 * jobs,
 *
 * When it receives a job it checks for an already existing record (indexed by session id) of an instance of the session module. If it doesn't exist it creates one. When it has the instance it calls the verb for that job. ie. instance.send(job, psession)
 *
 */
var Listener = {
  redis : require('redis'),
  promising : require('promising'),
  Session: require('./session'),
  platform: {
    name: '', // name of the platform
    module: '', // this is where the platform file is loaded into
    instances: {} // list of instances of the platform for each sessionId
  },
  initialized: false
};

var did;
Listener.init = function (platform) {
  this.platform.name = platform;
  did = ' [listener:' + platform + '] ';
  this.channel = {
    'incoming': 'sockethub:listener:' + platform + ':incoming',
    'subsystem': 'sockethub:listener:' + platform + ':subsystem'
  };

  console.info(did + 'initializing');
  this.rc = this.redis.createClient();
  this.rc.on('error', function (err) {
    console.error(did + 'error: ' + err);
  });


  // initialize platform module
  this.platform.module = require('./platforms/' + platform);
  if(! this.platform.module) {
    console.error(did + 'unable to load platform module in ' +
                  'lib/protocols/sockethub/platforms/' + platform);
    throw did + 'initalization failed.';
  }

  if (typeof this.platform.module.init !== 'function') {
    console.debug(did + 'platform.init = ' + typeof this.platform.module.init);
    throw 'platform ' + platform + ' must have init function! aborting.';
  }

  this.getJob();
  this.subSystem();
  console.info(did + 'initialization complete');
};


Listener.getJob = function (processFunc) {
  console.debug (did + 'getJob issued for ' +
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


Listener.getPlatformInstance = function (sessionId) {
  var promise = Listener.promising();
  var _this = this;
  if (typeof this.platform.instances[sessionId] === 'undefined') {
    // create new instance of the platform for this session
    var pi = Object.create(Listener.platform.module);
    Listener.platform.instances[sessionId] = pi;

    // since this is a newly instantiated session/platform, we need to call
    // the init function to set the session.
    _this.Session.get(sessionId).then(function (session) {
      return session.getPlatformSession(_this.platform.name);
    }).then(function (psession) {
      console.debug(did + 'initializing' +
                    ' platform instance for sessionId:' + sessionId);
      return pi.init(psession);
    }).then(function (err, status, obj) {
      console.debug(did + 'received result from init: err:' + err + ',' +
                    status + ', obj:'+obj);
      promise.fulfill(pi);
    }, function (err) {
      console.error(did + 'error returned from platform: ' + err);
      promise.reject(err);
    });
  } else {
    promise.fulfill(this.platform.instances[sessionId]);
  }
  return promise;
};


Listener.processJob = function (job) {
  console.debug(did + 'processJob called with job: ' + job.verb);
  var _this = this;
  var jobResp;
  _this.Session.get(job.sessionId).then(function (session) {
    jobResp = session.getResponseHandler(job);
    return Listener.getPlatformInstance(job.sessionId);
  }).then(function (pi) {
    console.debug(did + 'processJob() called');
    var handler = pi[job.verb]; // the platforms verb function
    if(! handler) {
      console.error(did + 'unable to handle jobs for ' + job.platform.name +
                  ' platform, platform handler doesn\'t implement verb ' +
                  job.verb);
    } else {
      // get ready to call the platforms verb function.
      console.info(did + 'sending job to platform handler');
      // now we call the platforms verb
      handler(job).then(function verbRes(err, status, obj) {
        console.info(did + 'received result from platform: err:' + err + ', ' +
                     status + ', obj:'+obj);
        jobResp(err, status, obj);
      }, function verbErr(err) {
        console.warn(did + 'error returned from platform: ' + err);
        jobResp(err, false);
      });
    }

    _this.getJob(); // start all over again
  }, function (err) {
    console.error(did + 'failed getting platform session. FAILURE');
    throw err;
  });
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
  Listener.getPlatformInstance(sessionId).then(function (pi) {
    if (typeof pi.cleanup === 'function') {
      platform.cleanup(); //, sessionId);
    }
    delete _this.platform.instances[sessionId];
    _this.Session.destroy(sessionId);
  });
  // XXX TODO FIXME: what else do we need to do during a cleanup?
  // - purge redis data
};


/*
 * subscribes to this platforms channel, responds to system level queries like
 * ping, cleanup
 */
Listener.subSystem = function () {
  console.info (did + 'subscribing to ' + this.channel.subsystem);
  var client = this.redis.createClient();
  var _this = this;
  client.on("message", function (channel, message) {
    console.info(did + 'platform received subsystem command');
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
    console.info(did + 'sending reply to ' +
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