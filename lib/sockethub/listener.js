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
 * When it receives a job it checks for an already existing record (indexed by
 * session id) of an instance of the session module. If it doesn't exist it
 * creates one. When it has the instance it calls the verb for that job. ie.
 * instance.send(job, psession)
 *
 */
var Listener = function () {
  //var redis = require('redis');
  //var domain = require('domain');
  var promising = require('promising');
  var util = require('./util.js');
  var Session;
  var platform = {
    name: '', // name of the platform
    module: '', // this is where the platform file is loaded into
    instances: {}, // list of instances of the platform for each sessionId
    location: undefined,
    verbs: {}
  };
  var initialized = false;
  var did;
  var pub = {};
  var _ = {};
  var channel = {};
  var sockethubId = '';
  var encKey = '';


  pub.init = function (p) {
    platform.name = ((p.platform) && (p.platform.name)) ? p.platform.name : undefined;
    platform.location = ((p.platform) && (p.platform.location)) ?
                        p.platform.location : './../platforms/'+p.platform.name;
    platform.verbs = ((p.platform) && (p.platform.verbs)) ? p.platform.verbs : undefined;
    sockethubId = (p.sockethubId) ? p.sockethubId : undefined;
    did = ' [listener:' + platform.name + '] ';

    if (p.encKey) {
      // if we're called directly, ie. for tests, we can establish session now
      // but usually the enckey is set in the subsystem ping during init and
      // so the session is initialized then.
      Session = require('./session')(sockethubId, p.encKey);
      encKey = p.ek;
    }
    channel = {
      'incoming': 'sockethub:' + sockethubId + ':listener:' + platform.name + ':incoming',
      'subsystem': 'sockethub:' + sockethubId + ':listener:' + platform.name + ':subsystem'
    };

    console.info(did + 'initializing');
    util.redis.on('error', function (err) {
      console.error(did + 'error: ' + err);
    });

    // initialize platform module
    console.debug(' [listener:'+platform.name+'] loading platform at: '+platform.location);
    platform.module = require(platform.location);
    if(! platform.module) {
      console.error(did + 'unable to load platform module in ' + platform.location);
      throw new util.SockethubError(did + 'initalization failed.', true);
    }

    var testInit;
    try {
      testInit = platform.module();
    } catch (e) {
      throw new util.SockethubError(e, true);
    }

    if (typeof testInit.init !== 'function') {
      console.debug(did + 'platform.init = ' + typeof testInit.init);
      throw new util.SockethubError('platform ' + platform.name + ' must have init function! aborting.', false);
    }
    testInit = '';

    _.getJob();
    _.subSystem();
    //console.info(did + 'initialization complete');
  };



  pub.shutdown = function (sids) {
    var promise = promising();
    console.info(did + ' shutting down...');

    if (typeof sids !== "object") {
      sids = [];
      for (var key in platform.instances) {
        sids.push(key);
      }
    }

    var sidsCompleted, i, num = 0;
    for (i = 0, len = sids.length; i < len; i = i + 1) {
      _.cleanupPlatform(sids[i]).then(function () {
        //console.info(did + 'sending subsystem response for ' + data.verb + ':'+data.object.sids[key]);
        sidsCompleted = sidsCompleted + 1;
      }, function (err) {
        sidsCompleted = sidsCompleted + 1;
        console.error(did + 'error cleaning up sid: '+data.object.sids[key]+ ' err:'+err);
      });
    }

    var count = 0;
    (function waitCleanup() {
      if (count === 5) {
        console.error(did+' platform instances cleanup timeout...');
        promise.fulfill();
      } else if (sidsCompleted < len) {
        console.debug(did + 'waiting for cleanup to finish...');
        count = count + 1;
        setTimeout(waitCleanup, 1000);
      } else {
        console.info(did+' shutdown complete');
        promise.fulfill();
      }
    })();
    return promise;
  };


  _.getJob = function (processFunc) {
    console.info (did + 'waiting for next job on queue: ' +
                  channel.incoming);
    util.redis.get('brpop', channel.incoming, function (err, replies){
      //console.log("ERR: ",err);
      //console.log(" [listener:"+_this.platform+"]   " + i + ": " + reply);
      var job_json = {};
      try {
        job_json = replies[1];
      } catch (e) {
        console.error(did + 'jon queue error with redis result: '+ e);
        throw new util.SockethubError('invalid data received from redis job queue', true);
      }
      //client.quit();
      var job;
      try {
        job = JSON.parse(job_json);
      } catch (e) {
        console.error(did + 'incoming job invalid json: ',job_json);
      }

      if (job) {
        _.processJob(job);
      } else {
        _.getJob();
      }
    });
  };


  _.processJob = function (job) {
    console.debug(did + 'processJob called with job: ' + job.verb);
    var platformFailure = false;
    var jobResp;
    Session.get(job.sessionId).then(function (session) {
      jobResp = session.getResponseHandler(job);
      return _.getPlatformInstance(job.sessionId);
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

        try {
          handler(job).then(function verbRes(err, status, obj) {
            console.debug(did + 'received result from platform: err:' + err + ', ' +
                         status + ', obj:', obj);
            if ((!err) && (typeof status === 'undefined')) {
              // if there's no error message, assume response is good
              status = true;
            }
            if (typeof obj === 'undefined') {
              obj = {};
            }
            jobResp(err, status, obj);
          }, function verbErr(err) {
            console.warn(did + 'error returned from platform: ' + err);
            jobResp(""+err, false);
          });
        } catch (e) {
          console.error('problem from platform: ' + e.toString());
          jobResp(""+e.toString(), false);
        }
      }

      if (!platformFailure) {
        _.getJob(); // start all over again
      }
    }, function (err) {
      console.error(did + 'failed getting platform session. FAILURE');
      throw err;
    });
  };


  _.getPlatformInstance = function (sessionId, create) {
    var promise = promising();
    create = (typeof create !== 'undefined') ? create : true;
    if (typeof platform.instances[sessionId] === 'undefined') {
      if (!create) { promise.reject(); }
      // create new instance of the platform for this session
      var pi = platform.module();
      platform.instances[sessionId] = pi;

      // since this is a newly instantiated session/platform, we need to call
      // the init function to set the session.
      Session.get(sessionId).then(function (session) {
        //console.debug(did + 'calling getPlatformSession with platform name: ',platform.name);
        return session.getPlatformSession(platform.name);
      }).then(function (psession) {
        console.debug(did + 'initializing platform instance for sessionId:' +
                            sessionId);
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
      promise.fulfill(platform.instances[sessionId]);
    }
    return promise;
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
  _.cleanupPlatform = function cleanupPlatform(sessionId) {
    var promise = promising();
    console.debug(did + 'cleanup platform '+sessionId);
    _.getPlatformInstance(sessionId, false).then(function (pi) {

      if (typeof pi.cleanup === 'function') {
        pi.cleanup().then(function cleanupRes() {
          return Session.destroy(sessionId);
        }).then(function sdRes() {
          delete platform.instances[sessionId];
          promise.fulfill();
        }, function cleanupErr(err) {
          promise.reject(err);
        });
      }

    }, function getPInstanceErr(err) {
      promise.reject(err);
    });
    return promise;
  };


  /**
   * subscribes to this platforms channel, responds to system level queries like
   * ping, cleanup
   */
  _.subSystem = function () {
    console.debug (did + 'subscribing to ' + channel.subsystem);

    util.redis.get('brpop', channel.subsystem, function (err, replies){
      var data;
      try {
        data = JSON.parse(replies[1]);
      } catch (e) {
        console.error(did + 'subsystem error with redis result: '+ e);
        throw new util.SockethubError('invalid JSON data received from redis subsystem queue', true);
      }
      console.info(did + 'platform received subsystem command ' + data.verb);
      var objData = {
        ping: {
          verb: 'ping',
          platform: platform.name,
          actor: {
            channel: channel.subsystem
          },
          status: true
        },
        cleanup: {
          verb: 'cleanup',
          platform: platform.name,
          actor: {
            channel: channel.subsystem
          },
          object: {
          },
          status: true
        }
      };

      var responseObj = objData[data.verb];
      if (data.verb === 'cleanup') {
        if (typeof data.object.sids.length === "undefined") {
          console.error(did + 'FAIL: '+e, data);
        } else {
          pub.shutdown(data.object.sids).then(function () {
            console.info(did + 'sending ' + data.verb + ' reply to ' +
                         data.actor.channel);
            util.redis.set('lpush', data.actor.channel, JSON.stringify(responseObj));
            _.subSystem();
          });
        }
      } else {
        console.info(did + 'sending ' + data.verb + ' reply to ' +
                     data.actor.channel);
        if (data.object.encKey) {
          encKey = data.object.encKey;
          Session = require('./session')(sockethubId, encKey);
        }
        util.redis.set('lpush', data.actor.channel, JSON.stringify(responseObj));
         _.subSystem();
      }
    });
  };

  return pub;
};

module.exports = Listener;