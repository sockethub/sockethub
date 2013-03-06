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
var Listener = function () {
  var redis = require('redis');
  var promising = require('promising');
  var Session;
  var platform = {
    name: '', // name of the platform
    module: '', // this is where the platform file is loaded into
    instances: {} // list of instances of the platform for each sessionId
  };
  var initialized = false;
  var did;
  var pub = {};
  var _ = {};
  var channel = {};
  var sockethubId = '';

  pub.init = function (plat, shId) {
    platform.name = plat;
    did = ' [listener:' + plat + '] ';
    sockethubId = shId;
    channel = {
      'incoming': 'sockethub:' + sockethubId + ':listener:' + plat + ':incoming',
      'subsystem': 'sockethub:' + sockethubId + ':listener:' + plat + ':subsystem'
    };
    Session = require('./session')(shId);

    console.info(did + 'initializing');
    var rc = redis.createClient();
    rc.on('error', function (err) {
      console.error(did + 'error: ' + err);
    });


    // initialize platform module
    platform.module = require('./platforms/' + plat);
    if(! platform.module) {
      console.error(did + 'unable to load platform module in ' +
                    'lib/protocols/sockethub/platforms/' + plat);
      throw did + 'initalization failed.';
    }

    var testInit = platform.module();
    if (typeof testInit.init !== 'function') {
      console.debug(did + 'platform.init = ' + typeof testInit.init);
      throw 'platform ' + plat + ' must have init function! aborting.';
    }
    testInit = '';

    _.getJob();
    _.subSystem();
    //console.info(did + 'initialization complete');
  };


  _.getJob = function (processFunc) {
    console.info (did + 'waiting for next job on queue: ' +
                  channel.incoming);
    var client = redis.createClient();
    client.blpop(channel.incoming, 0, function(err, replies) {
      //console.log("ERR: ",err);
      //console.log(" [listener:"+_this.platform+"]   " + i + ": " + reply);
      //console.debug(did + 'fresh from the queue: ',replies);
      var job_json = replies[1];
      //console.debug(did + 'got new job: ',replies.toString());
      client.quit();
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
        // now we call the platforms verb
        handler(job).then(function verbRes(err, status, obj) {
          console.info(did + 'received result from platform: err:' + err + ', ' +
                       status + ', obj:'+obj);
          if (typeof status === 'undefined') {
            status = true;
          }
          jobResp(err, status, obj);
        }, function verbErr(err) {
          console.warn(did + 'error returned from platform: ' + err);
          jobResp(err, false);
        });
      }

      _.getJob(); // start all over again
    }, function (err) {
      console.error(did + 'failed getting platform session. FAILURE');
      throw err;
    });
  };


  _.getPlatformInstance = function (sessionId) {
    var promise = promising();
    if (typeof platform.instances[sessionId] === 'undefined') {
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
    _.getPlatformInstance(sessionId).then(function (pi) {

      if (typeof pi.cleanup === 'function') {
        pi.cleanup().then(function cleanupRes() {
          return Session.destroy(sessionId);
        }).then(function sdRes() {
          client.quit();
          delete platform.instances[sessionId];
          promise.fulfill();
        }, function cleanupErr(err) {
          promise.reject(err);
        });
      }

    }, function getPInstanceErr(err) {
      promise.reject(err);
    });
    // XXX TODO FIXME: what else do we need to do during a cleanup?
    // - purge redis data
    return promise;
  };


  /*
   * subscribes to this platforms channel, responds to system level queries like
   * ping, cleanup
   */
  _.subSystem = function () {
    console.debug (did + 'subscribing to ' + channel.subsystem);
    var client = redis.createClient();

    client.blpop(channel.subsystem, 0, function(err, replies) {
      var data;
      try {
        data = JSON.parse(replies[1]);
      } catch (e) {
        console.error(did + 'subsystem command sent bad json: ', message);
        return;
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

      client.quit();
      var client2 = redis.createClient();
      var responseObj = objData[data.verb];
      if (data.verb === 'cleanup') {
        var sidsCompleted = 0;
        var num;
        try {
          num = data.object.sids.length;
        } catch (e) {
          console.error('FAIL: ',data);
          _.subSystem();
        }
        for (var i = 0; i < num; i = i + 1) {
          var sid = data.object.sids[i];
          _.cleanupPlatform(sid).then(function cpR() {
            //console.info(did + 'sending subsystem response for ' + data.verb + ':'+data.object.sids[key]);
            sidsCompleted = sidsCompleted + 1;
          }, function cpE(err) {
            sidsCompleted = sidsCompleted + 1;
            console.error(did + 'error cleaning up sid: '+data.object.sids[key]+ ' err:'+err);
          });
        }

        (function waitCleanup() {
          if (sidsCompleted < num) {
            console.debug(did + 'waiting for cleanup to finish...');
            setTimeout(waitCleanup, 1000);
          } else {
            console.info(did + 'sending ' + data.verb + ' reply to ' +
                         data.actor.channel);    client2.lpush(data.actor.channel, JSON.stringify(responseObj));
            _.subSystem();
          }
        })();
      } else {
        console.info(did + 'sending ' + data.verb + ' reply to ' +
                     data.actor.channel);
        client2.lpush(data.actor.channel, JSON.stringify(responseObj));
         _.subSystem();
      }
    });
  };

  return pub;
};

module.exports = Listener;