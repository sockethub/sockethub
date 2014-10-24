/**
 * This file is part of sockethub.
 *
 * copyright 2012-2013 Nick Jennings (https://github.com/silverbucket)
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
var Q              = require('q');
var SessionManager = require('./session-manager.js');
var forEachAsync   = require('forEachAsync').forEachAsync;
var redisPool      = require('redis-connection-pool')('sockethubRedisPool', {
  MAX_CLIENTS: 30
});

/**
 * Class: Listener
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
function Listener(p) {
  this.platform = {
    // name of the platform
    name: ((p.platform) && (p.platform.name)) ? p.platform.name : undefined,
    module: '', // this is where the platform file is loaded into
    instances: {}, // list of instances of the platform for each sessionId
    location: ((p.platform) && (p.platform.location)) ?
                        p.platform.location : './../platforms/' + p.platform.name,
    // list of verbs supported by this platform
    verbs: ((p.platform) && (p.platform.verbs)) ? p.platform.verbs : undefined
  };

  this.did = ' [listener:' + this.platform.name + '] ';
  this.sockethubId = (p.sockethubId) ? p.sockethubId : undefined;
  this.channel = {
    'incoming': 'sockethub:' + this.sockethubId + ':listener:' + this.platform.name + ':incoming',
    'subsystem': 'sockethub:' + this.sockethubId + ':listener:' + this.platform.name + ':subsystem'
  };
  this.encKey = '';
  if (p.encKey) {
    // if we're called directly, ie. for tests, we can establish session now
    // but usually the enckey is set within the session object as broadcasted
    // by the dispatcher.
    this.sessionManager = new SessionManager({
      platform: this.platform.name,
      sockethubId: this.sockethubId,
      encKey: p.encKey
    });
    this.encKey = p.encKey;
  } else {
    // initialize session without enckey (will receive via redis broadcast)
    this.sessionManager = new SessionManager({
      platform: this.platform.name,
      sockethubId: this.sockethubId
    });
  }
  var self = this;

  //console.info(did + 'initializing');
  redisPool.on('error', function (err) {
    console.error(self.did + 'error: ' + err);
  });

  //
  // initialize platform module
  this.platform.module = require(this.platform.location);
  if(! this.platform.module) {
    console.error(this.did + 'unable to load platform module in ' + this.platform.location);
    throw new Error(this.did + 'initalization failed');
  }

  var testInit;
  try {
    testInit = this.platform.module();
  } catch (e) {
    throw new Error(e);
  }

  if (typeof testInit.init !== 'function') {
    console.debug(this.did + 'platform.init = ' + typeof testInit.init);
    throw new Error('platform ' + this.platform.name + ' must have init function! aborting');
  }

  if (!this.encKey) {
    console.debug(this.did + 'requesting encKey from dispatcher');
    self.sessionManager.subsystem.send('ping', {requestEncKey: true, timestamp: new Date().getTime()}, 'dispatcher');
  }

  //
  // When the session module emits a 'cleanup' event, the listener handles it
  // here.
  //
  // If no sessionId (sid) is specified, it's implied that a full shutdown
  // is happening (ie. either a listener restart due to uncaught error, or
  // sockethub is shutting down).
  //
  // If an sid is specified, then the listener sends a cleanup command to the
  // platform, and also removes any client connections that are registered
  // with this platform + session.
  //
  self.sessionManager.events.on('cleanup', function (sid) {
    if (!sid) {
      self.shutdown();
    } else {
      try {
        console.debug(self.did + ' ' + sid + ' cleanup called');
        self.sessionManager.get(sid, false).then(function (session) {
          return session.getPlatformSession(self.platform.name);
        }).then(function (psession) {
          // remove all keys associated with this platform+sid
          var keys = psession.clientManager.getKeys(); // list of client 'id's (names to retrieve with)
          //console.debug(did + ' ' + sid + ' keys to remove for this session: ', keys);
          for (var i = 0, len = keys.length; i < len; i = i + 1) {

            // FIXME TODO - we need a connection param, but it's almost always going
            // to be the platform name right? so how can we automate this? so that
            // they do not need to specifying a second param and we can guess
            // at the property name? (for to be platform name?)
            psession.clientManager.removeListeners(keys[i], self.platform.name);

            //
            // indicate to clientManager this client can be removed
            console.debug(self.did + ' ' + sid + ' clientManager.remove('+keys[i]+')');
            psession.clientManager.remove(keys[i]);
          }

          self._cleanupPlatform(sid).then(function () {
            //console.info(did + ' ' + sid + ' cleanup complete');
          }, function (err) {
            console.error(self.did + ' ' + sid + ' error cleaning up: ' + err);
          });

        }, function (err) {
          console.info(self.did + ' ' + sid + ' no session exists for ' + sid + ': ' + err);
        });

      } catch (e) {
        console.error(self.did + ' ' + sid + ' caught unknown error during cleaning up: ' + e);
      }
    }
  });

  setTimeout(function waitForEncKey() {
    if (self.sessionManager.encKeySet()) {
      console.info(self.did + 'initialization complete');
      self._getJob();
    } else {
      console.debug(self.did + 'encKey not yet set, delaying');
      setTimeout(waitForEncKey, 500);
    }
  }, 1000);
  return this;
}

Listener.prototype.shutdown = function (sids) {
  var q = Q.defer();
  var self = this;
  console.debug(this.did + 'shutting down...');

  if (typeof sids !== "object") {
    sids = [];
    for (var key in this.platform.instances) {
      if ((typeof key === 'string') && (key)) {
        sids.push(key);
      }
    }
  }

  self.sessionManager.destroy();
  var sidsCompleted = 0;
  forEachAsync(sids, function (nextElem, sid, i, array) {
    self._cleanupPlatform(sid).then(function () {
      sidsCompleted = sidsCompleted + 1;
    }, function (err) {
      sidsCompleted = sidsCompleted + 1;
      console.error(self.did + 'error cleaning up sid: ' + sid +
                    ' err:' + err);
    });
  }).then(function () {
    var count = 0;
    (function waitCleanup() {
      if (count === 5) {
        console.error(self.did + ' platform instances cleanup timeout...');
        q.resolve();
      } else if (sidsCompleted < sids.length) {
        console.debug(self.did + 'waiting for cleanup to finish...');
        count = count + 1;
        setTimeout(waitCleanup, 1000);
      } else {
        console.info(self.did + ' shutdown complete');
        q.resolve();
      }
    })();
  });

  return q.promise;
};


Listener.prototype._getJob = function () {
  console.debug (this.did + 'queueing for job: ' +
                this.channel.incoming);
  var self = this;
  redisPool.blpop(this.channel.incoming, function (err, replies){
    var job_json = {};
    var job;
    var bad_job = false;

    if (typeof replies[1] === 'undefined') {
      console.error(self.did + 'got invalid result from redis queue: ', replies);
    } else {
      try {
        job_json = replies[1];
      } catch (e) {
        console.error(self.did + 'job queue error with redis result: ' + e);
        bad_job = true;
      }
      if (!bad_job) {
        try {
          job = JSON.parse(job_json);
        } catch (e) {
          console.error(self.did + 'incoming job invalid json: ', job_json);
        }
      }
    }

    if (job) {
      self._processJob(job);
    }
    self._getJob(); // start all over again
  });
};


Listener.prototype._processJob = function (job) {
  console.debug(this.did + 'processJob called with job: ' + job.verb);
  var jobResp;
  if (!job.sessionId) {
    throw new Error('job has no sessionId');
  }
  var self = this;
  self.sessionManager.get(job.sessionId).then(function (session) {
    jobResp = session.getResponseHandler(job);
    return self._getPlatformInstance(job.sessionId);
  }).then(function (pi) {
    console.debug(self.did + 'processJob() called');
    if(! pi[job.verb]) {
      console.error(self.did + 'unable to handle jobs for ' + job.platform.name +
                    ' platform, platform handler doesn\'t implement verb ' +
                    job.verb);
    } else {
      // get ready to call the platforms verb function.
      console.info(self.did + 'sending job to platform ' + job.verb + '()');
      try {
        pi[job.verb](job).then(function (obj) {
          self._jobSuccess(jobResp, obj);
        }, function (err, obj) {
          self._jobFailure(jobResp, err, obj);
        }).fail(function (e) {
          var stack;
          if (e.hasOwnProperty('stack')) {
            stack = e.stack;
          } else {
            stack = new Error('').stack;
          }
          console.error(self.did + 'problem from platform ' + e.toString(), stack);
          jobResp("" + e.toString(), false);
          setTimeout(function () {
            throw new Error(self.did + 'RESET PLATFORM on call to [' + job.verb +
                            ']: ' + e.toString());
          }, 0);
        });
      } catch (e) {
        var stack;
        if (e.hasOwnProperty('stack')) {
          stack = e.stack;
        } else {
          stack = new Error('').stack;
        }
        console.error(self.did + 'problem from platform ' + e.toString(), stack);
        jobResp("" + e.toString(), false);
        setTimeout(function () {
          throw new Error(self.did + 'RESET PLATFORM on call to [' + job.verb +
                          ']: ' + e.toString());
        }, 0);
      }
    }
  }, function (err) {
    console.error(self.did + 'failed getting platform session. FAILURE: ' + err);
    setTimeout(function () {
      throw new Error(self.did + 'RESET PLATFORM on init: ', err);
    }, 0);
  });
};


Listener.prototype._jobSuccess = function (jobResp, obj) {
  console.debug(this.did + 'received successful result from platform');
  if (typeof obj === 'undefined') {
    obj = {};
  }
  jobResp(null, true, obj);
};


Listener.prototype._jobFailure = function (jobResp, err, obj) {
  console.warn(this.did + 'error returned from platform: ' + err);
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
        console.debug(this.did+'failed getting error message from err:', err);
      }
    }
  } else if (typeof err === 'string') {
    err_string = err;
  } else {
    err_string = "" + err;
  }
  jobResp(err_string, false, obj);
};


Listener.prototype._getPlatformInstance = function (sessionId, create) {
  var q = Q.defer();
  var self = this;
  create = (typeof create !== 'undefined') ? create : true;
  if (typeof self.platform.instances[sessionId] === 'undefined') {
    if (create) {
      // create new instance of the platform for this session
      var pi = self.platform.module();

      // since this is a newly instantiated session/platform, we need to call
      // the init function to set the session.
      self.sessionManager.get(sessionId).then(function (session) {
        //console.debug(self.did + 'calling getPlatformSession with platform name: ', self.platform.name);
        return session.getPlatformSession(self.platform.name);
      }).then(function (psession) {
        console.debug(self.did + 'initializing platform instance for sessionId:' +
                            sessionId);
        self.platform.instances[sessionId] = pi;
        return pi.init(psession);
      }).then(function () {
        console.debug(self.did + 'platform initialization success for sessionId:' +
                            sessionId);
        q.resolve(pi);
      }, q.reject);
    } else {
      q.resolve(undefined);
    }
  } else {
    q.resolve(self.platform.instances[sessionId]);
  }
  return q.promise;
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
 */
Listener.prototype._cleanupPlatform = function (sessionId) {
  var q = Q.defer();
  var self = this;
  console.debug(self.did + 'cleanup platform ' + sessionId);
  self._getPlatformInstance(sessionId, false).then(function (pi) {
    if ((pi) && (typeof pi.cleanup === 'function')) {
      pi.cleanup().then(function () {
        q.resolve();
      }, function (err) {
        q.reject(err);
      });
    } else {
      q.resolve();
    }
    delete self.platform.instances[sessionId];
  }, q.reject);
  return q.promise;
};

Listener.prototype.encKeySet = function() {
  var self = this;
  return ((typeof self.sessionManager === 'object') &&
          (typeof self.sessionManager.encKeySet === 'function')) ? self.sessionManager.encKeySet() : undefined;
};

module.exports = function(a) {
  return new Listener(a);
};
