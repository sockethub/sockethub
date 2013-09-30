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
var promising = require('promising');
var util = require('./util.js');
var SessionManager = require('./session');

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
var Listener = function (p) {
  var platform = {
    // name of the platform
    name: ((p.platform) && (p.platform.name)) ? p.platform.name : undefined,
    module: '', // this is where the platform file is loaded into
    instances: {}, // list of instances of the platform for each sessionId
    location: ((p.platform) && (p.platform.location)) ?
                        p.platform.location : './../platforms/' + p.platform.name,
    // list of verbs supported by this platform
    verbs: ((p.platform) && (p.platform.verbs)) ? p.platform.verbs : undefined
  };

  var did = ' [listener:' + platform.name + '] ';
  var sockethubId = (p.sockethubId) ? p.sockethubId : undefined;
  var channel = {
    'incoming': 'sockethub:' + sockethubId + ':listener:' + platform.name + ':incoming',
    'subsystem': 'sockethub:' + sockethubId + ':listener:' + platform.name + ':subsystem'
  };
  var encKey = '';
  var sessionManager = '';
  if (p.encKey) {
    // if we're called directly, ie. for tests, we can establish session now
    // but usually the enckey is set within the session object as broadcasted
    // by the dispatcher.
    sessionManager = SessionManager({platform: platform.name,
                                     sockethubId: sockethubId,
                                     encKey: p.encKey});
    encKey = p.encKey;
  } else {
    // initialize session without enckey (will receive via redis broadcast)
    sessionManager = SessionManager({platform: platform.name,
                                     sockethubId: sockethubId});
  }

  //console.info(did + 'initializing');
  util.redis.on('error', function (err) {
    console.error(did + 'error: ' + err);
  });

  // initialize platform module
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

  if (!encKey) {
     console.debug(did + 'requesting encKey from dispatcher');
    sessionManager.subsystem.send('ping', {requestEncKey: true, timestamp: new Date().getTime()}, 'dispatcher');
  }

  sessionManager.events.on('cleanup', function (sid) {
    if (!sid) {
      shutdown();
    } else {
      try {
        sessionManager.get(sid).then(function (session) {
          return session.getPlatformSession(platform.name);
        }).then(function (psession) {
          // remove all keys associated with this platform+sid
          var keys = psession.clientManager.getKeys();
          for (var i = 0, len = keys.length; i < len; i = i + 1) {

            // FIXME TODO - we need a connection param, but it's almost always going
            // to be the platform name right? so how can we automate this? so that
            // they do not need to specifying a second param and we can guess
            // at the property name? (for to be platform name?)
            psession.clientManager.removeListeners(keys[i], platform.name);

            //
            // indicate to clientManager this client can be removed
            psession.clientManager.remove(keys[i]);
          }

          _cleanupPlatform(sid).then(function () {
            console.info(did + 'cleanup complete');
          }, function (err) {
            console.error(did + 'error cleaning up: ' + err);
          });

        }, function (err) {
          console.log(did + 'no session exists for ' + sid);
        });

      } catch (e) {
        console.error(did + 'caught unknown error during cleaning up: ' + e);
      }
    }
  });

  setTimeout(function waitForEncKey() {
    if (sessionManager.encKeySet()) {
      console.info(did + 'initialization complete');
      _getJob();
    } else {
      console.debug(did + 'encKey not yet set, delaying');
      setTimeout(waitForEncKey, 500);
    }
  }, 1000);



  function shutdown(sids) {
    var promise = promising();
    console.info(did + 'shutting down...');

    if (typeof sids !== "object") {
      sids = [];
      for (var key in platform.instances) {
        sids.push(key);
      }
    }
    sessionManager.destroy();
    var sidsCompleted, i, num = 0;
    for (i = 0, len = sids.length; i < len; i = i + 1) {
      _cleanupPlatform(sids[i]).then(function () {
        //console.info(did + 'sending subsystem response for ' +
        //             data.verb + ':' + data.object.sids[key]);
        sidsCompleted = sidsCompleted + 1;
      }, function (err) {
        sidsCompleted = sidsCompleted + 1;
        console.error(did + 'error cleaning up sid: ' + data.object.sids[key] +
                      ' err:' + err);
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
  }


  function _getJob(processFunc) {
    console.debug (did + 'queueing for job: ' +
                  channel.incoming);
    util.redis.get('blpop', channel.incoming, function (err, replies){
      //console.log("ERR: ",err);
      //console.log(" [listener:"+_this.platform+"]   " + i + ": " + reply);
      var job_json = {};
      try {
        job_json = replies[1];
      } catch (e) {
        console.error(did + 'job queue error with redis result: ' + e);
        throw new util.SockethubError('invalid data received from redis job queue', true);
      }
      var job;
      try {
        job = JSON.parse(job_json);
      } catch (e) {
        console.error(did + 'incoming job invalid json: ',job_json);
      }

      if (job) {
        _processJob(job);
      }
      _getJob(); // start all over again
    });
  }


  function _processJob (job) {
    console.debug(did + 'processJob called with job: ' + job.verb);
    var jobResp;
    if (!job.sessionId) {
      throw new Error('job has no sessionId');
    }
    sessionManager.get(job.sessionId).then(function (session) {
      jobResp = session.getResponseHandler(job);
      return _getPlatformInstance(job.sessionId);
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
          handler(job).then(function (obj) {
            _jobSuccess(jobResp, obj);
          }, function (err, obj) {
            _jobFailure(jobResp, err, obj);
          });
        } catch (e) {
          console.error(did + 'problem from platform ' + e.toString());
          jobResp(""+e.toString(), false);
          setTimeout(function () {
            throw new Error(did + 'RESET PLATFORM on call to [' + job.verb +
                            ']: ' + e.toString());
          }, 0);
        }
      }
    }, function (err) {
      console.error(did + 'failed getting platform session. FAILURE: ' + err);
      setTimeout(function () {
        throw new Error(did + 'RESET PLATFORM on init: ', err);
      }, 0);
    });
  }


  function _jobSuccess(jobResp, obj) {
    console.debug(did + 'received successful result from platform.');
    if (typeof obj === 'undefined') {
      obj = {};
    }
    jobResp(null, true, obj);
  }


  function _jobFailure(jobResp, err, obj) {
    console.warn(did + 'error returned from platform: ' + err);
    if (typeof obj === 'undefined') {
      obj = {};
    }
    var err_string = '';
    if (typeof err === 'object') {
      if (typeof err.toString === 'function') {
        err_string = err.toString();
      } else if (typeof err.message === 'string') {
        err_string = err.message;
      } else {
        try {
          err_string = JSON.strinfigy(err);
        } catch (e) {
          console.debug(did+'failed getting error message from err:',err);
        }
      }
    } else if (typeof err === 'string') {
      err_string = err;
    } else {
      err_string = ""+err;
    }
    jobResp(err_string, false, obj);
  }


  function _getPlatformInstance(sessionId, create) {
    var promise = promising();
    create = (typeof create !== 'undefined') ? create : true;
    if (typeof platform.instances[sessionId] === 'undefined') {
      if (create) {
        // create new instance of the platform for this session
        var pi = platform.module();
        platform.instances[sessionId] = pi;

        // since this is a newly instantiated session/platform, we need to call
        // the init function to set the session.
        sessionManager.get(sessionId).then(function (session) {
          //console.debug(did + 'calling getPlatformSession with platform name: ',platform.name);
          return session.getPlatformSession(platform.name);
        }).then(function (psession) {
          console.debug(did + 'initializing platform instance for sessionId:' +
                              sessionId);
          return pi.init(psession);
        }).then(function (err, status, obj) {
          console.debug(did + 'platform initialization success for sessionId:' +
                              sessionId);
          promise.fulfill(pi);
        }, promise.reject);
      } else {
        promise.fulfill(undefined);
      }
    } else {
      promise.fulfill(platform.instances[sessionId]);
    }
    return promise;
  }


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
  function _cleanupPlatform(sessionId) {
    var promise = promising();
    console.debug(did + 'cleanup platform ' + sessionId);
    _getPlatformInstance(sessionId, false).then(function (pi) {
      if ((pi) && (typeof pi.cleanup === 'function')) {
        pi.cleanup().then(function () {
          promise.fulfill();
        }, function (err) {
          promise.reject(err);
        });
      } else {
        promise.fulfill();
      }
      delete platform.instances[sessionId];
    }, promise.reject);
    return promise;
  }


  return {
    encKeySet: function() {
      return ((typeof sessionManager === 'object') &&
              (typeof sessionManager.encKeySet === 'function')) ? sessionManager.encKeySet() : undefined;
    },
    shutdown: shutdown
  };
};

module.exports = Listener;