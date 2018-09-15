const kue               = require('kue'),
      nconf             = require('nconf'),
      Debug             = require('debug'),
      domain            = require('domain'),
      dsCrypt           = require('dead-simple-crypt'),
      activity          = require('activity-streams')(nconf.get('activity-streams:opts')),
      randToken         = require('rand-token'),
      Store             = require('secure-store-redis'),
      hash              = require('object-hash');

const SR = require('./shared-resources');

let sockethubSecret, workerSecret; // inaccessible outside this file

function Worker(cfg) {
  sockethubSecret  = cfg.sockethubSecret;
  workerSecret     = cfg.workerSecret;
  this.id          = cfg.id;
  this.socket      = cfg.socket;
  this.sockethubId = cfg.sockethubId;
  this.debug       = Debug('sockethub:worker:' + this.id);

  // TODO is there a way to get a callback when a kue is successfully created?
  let redisCfg = nconf.get('redis');
  if (redisCfg.url) {
    redisCfg = redisCfg.url;
  }
  this.queue = kue.createQueue({
    prefix: 'sockethub:' + this.sockethubId + ':queue',
    redis: redisCfg
  });

  this.Platforms = [];
  for (let i = 0, len = cfg.platforms.length; i < len; i++) {
    try {
      this.Platforms[cfg.platforms[i]] = require('sockethub-platform-' + cfg.platforms[i]);
    } catch (e) {
      throw new Error(e);
    }
  }

  // store object to fetch credentials stored for this specific socket connection
  this.store = new Store({
    namespace: 'sockethub:' + this.sockethubId + ':worker:' + this.id + ':store',
    secret: sockethubSecret + workerSecret,
    redis: nconf.get('redis')
  });
}


Worker.prototype.boot = function () {
  this.debug('initializing');
  // each job comes in on this handler, with the job object and a `done` callback
  this.queue.process(this.id, (job, done) => {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, sockethubSecret));
    this.debug('got job: ' + job.data.msg['@type']);
    let platformInstance = SR.platformInstances.get(job.data.msg.actor['@id']);

    if (! platformInstance) {
      this.debug('creating new ' + job.data.msg.context + ' platform instance for '
                 + job.data.msg.actor['@id']);
      platformInstance = {
        id: job.data.msg.actor['@id'],
        name: job.data.msg.context,
        module: new this.Platforms[job.data.msg.context]({
          id: job.data.msg.actor['@id'],
          debug: Debug('sockethub:worker:' + job.data.msg.context + ':module:'
                       + job.data.msg.actor['@id']),
          sendToClient: this.generateSendFunction(job.data.msg.actor['@id'])
        }),
        credentialsHash: undefined,
        flaggedForTermination: false,
        sockets: new Set()
      };
    }

    // try to get credentials for this specific secret + socket.id
    // (each wesocket connection must specify credentials to access initialized platforms)
    this.store.get(job.data.msg.actor['@id'], (err, credentials) => {
      if (platformInstance.module.config.persist) {
        if (err) {
          return done(err); // don't continue if we don't get credentials
        }
        this.debug(`setting platform instance ${platformInstance.id}`);
        SR.platformInstances.set(platformInstance.id, platformInstance); // add or update record
      }

      if (platformInstance.credentialsHash) {
        if (platformInstance.credentialsHash !== hash(credentials)) {
          return done('provided credentials do not match existing platform instance for actor '
                      + job.data.msg.actor['@id']);
        }
      } else {
        platformInstance.credentialsHash = hash(credentials);
      }

      platformInstance.sockets.add(this.id); // add reference to this socket
      this.executeJob(job, platformInstance, credentials, done);
    });
  });
};


Worker.prototype.executeJob = function (job, platformInstance, credentials, done) {
  const d              = domain.create(),
        activityStream = job.data.msg,
        // the callback provided to the platformInstance
        _callback      = ((called) => {
          return (err, obj) => {
            // this.debug('job done called for ' + activityStream['@type']);
            if (called) { return; }
            called = true;
            d.exit();
            done(err, obj);
          };
        })(false);

  d.on('error', (err) => {
    this.debug('caught platform domain error: ', err.stack);
    // cleanup module whenever an exception is thrown
    const sendToClient = this.generateSendFunction(platformInstance.id);
    sendToClient({
      context: platformInstance.name,
      '@type': 'connect',
      target: platformInstance.id,
      object: {
        '@type': 'error',
        content: err.toString()
      }
    });

    platformInstance.module.cleanup(() => {
      SR.platformInstances.delete(platformInstance.id);
      this.debug('disposing of domain');
      d.exit();
      return done(new Error(err));
    });
  });

  // run corresponding platformInstance method
  d.run(() => {
    // normal call params to platformInstances are `job` then `callback`
    platformInstance.module[activityStream['@type']](activityStream, credentials, _callback);
  });
};


Worker.prototype.shutdown = function () {
  this.debug('shutting down');
  SR.platformInstances.forEach((platformInstance) => {
    if (platformInstance.sockets.has(this.id)) {
      platformInstance.sockets.delete(this.id);
    }
  });
  SR.socketConnections.delete(this.id);
};


Worker.prototype.generateSendFunction = function (key) {
  return (msg) => {
    if (typeof msg !== 'object') {
      this.debug('sendToClient called with no message: ', msg);
      return;
    }
    const platformInstance = SR.platformInstances.get(key);
    if (! platformInstance) {
      this.debug('received send message for a platform instance which cannot be found: ' + key);
      return;
    }
    platformInstance.sockets.forEach((id) => {
      const socket = SR.socketConnections.get(id);
      if (! socket) { // stale socket reference
        this.debug(`deleting stale socket reference ${id}`);
        SR.socketConnections.delete(id);
        platformInstance.sockets.delete(id);
        if (this.id === id) {
          this.shutdown();
        }
        return;
      }
      msg.context = platformInstance.name;
      this.debug('sending message to socket');
      socket.emit('message', msg);
    });
  };
};


module.exports = Worker;