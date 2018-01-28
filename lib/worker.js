const kue               = require('kue'),
      nconf             = require('nconf'),
      Debug             = require('debug'),
      domain            = require('domain'),
      dsCrypt           = require('dead-simple-crypt'),
      activity          = require('activity-streams')(nconf.get('activity-streams:opts')),
      randToken         = require('rand-token'),
      ArrayKeys         = require('array-keys'),
      Store             = require('secure-store-redis');

const SR = require('./shared-resources');

let sockethubID, secret;

function Worker(cfg) {
  sockethubID    = cfg.sockethubID;
  secret         = cfg.secret;
  this.id        = cfg.id;
  this.socket    = cfg.socket;
  this.debug     = Debug('sockethub:worker:' + this.id);

  // TODO is there a way to get a callback when a kue is successfully created?
  let redisCfg = nconf.get('redis');
  if (redisCfg.url) {
    redisCfg = redisCfg.url
  }
  this.queue = kue.createQueue({
    prefix: 'sockethub:' + sockethubID + ':queue',
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
}


Worker.prototype.boot = function () {
  this.debug('initializing');

  // each job comes in on this handler, with the job object and a `done` callback
  this.queue.process(this.id, (job, done) => {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, secret));
    this.debug('got job: ' + job.data.msg['@type']);
    let platformInstance = SR.platformInstances.getRecord(job.data.msg.actor['@id']);

    if (! platformInstance) {
      this.debug('creating new ' + job.data.msg.context + ' platform instance for ' + job.data.msg.actor['@id']);
      platformInstance = {
        id: job.data.msg.actor['@id'],
        name: job.data.msg.context,
        module: new this.Platforms[job.data.msg.context]({
          id: job.data.msg.actor['@id'],
          debug: Debug('sockethub:worker:' + job.data.msg.context + ':module:' + job.data.msg.actor['@id']),
          sendToClient: this.generateSendFunction(job.data.msg.actor['@id'])
        }),
        flaggedForTermination: false,
        sockets: new Set([this.id])
      };
      if (typeof platformInstance.module.config !== 'object') {
        return done('error initializing platform, must have a config property that is an object.');
      }
    }

    platformInstance.sockets.add(this.id); // add reference to this socket
    if (platformInstance.module.config.persist) {
      SR.platformInstances.addRecord(platformInstance); // add or update record
    }

    // try to get credentials for this specific secret + socket.id 
    // (each wesocket connection must specify credentials to access initialized platforms)
    this.getCredentials(job.data.msg.actor['@id'], job.data.msg.context, (err, credentials) => {
      if ((platformInstance.module.config.persist) && (err)) { return done(err); }
      this.executeJob(job, platformInstance, credentials, done);
    });
  });
};


Worker.prototype.getCredentials = function (key, platform, cb) {
  // this.debug('attempting to fetch credentials in ' + platform + ' store with key ' + key);
  const store = new Store({
    namespace: 'sockethub:' + sockethubID + ':store:' + platform,
    secret: secret + this.id,
    redis: nconf.get('redis')
  });
  store.get(key, cb);
};

Worker.prototype.executeJob = function (job, platformInstance, credentials, done) {
  const activityStream = job.data.msg;
  const d = domain.create();
  // the callback provided to the platformInstance
  const _callback = ((called) => {
    return (err, obj) => {
      this.debug('job done called for ' + activityStream['@type']);
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
      SR.platformInstances.removeRecord(platformInstance.id); 
      this.debug('disposing of domain');
      d.exit();
      return done(new Error(err));
    });
  });

  // run corresponding platformInstance method
  const t = d.run(() => {
    // normal call params to platformInstances are `job` then `callback`
    platformInstance.module[activityStream['@type']](activityStream, credentials, _callback);
  });
};


Worker.prototype.shutdown = function () {
  this.debug('shutting down');
  SR.platformInstances.forEachRecord((platformInstance) => {
    if (platformInstance.sockets.has(this.id)) {
      platformInstance.sockets.delete(this.id);
    }
  });
  SR.socketConnections.removeRecord(this.id);
};


Worker.prototype.generateSendFunction = function (key) {
  return (msg) => {
    if (typeof msg !== 'object') {
      this.debug('sendToClient called with no message: ', msg);
      return;
    }
    const platformInstance = SR.platformInstances.getRecord(key);
    if (! platformInstance) { 
      this.debug('received send message for a platform instance which cannot be found: ' + key);
      return; 
    }
    platformInstance.sockets.forEach((id) => {
      const socket = SR.socketConnections.getRecord(id);
      if (! socket) { // stale socket reference
        SR.socketConnections.removeRecord(id);
        platformInstance.sockets.delete(id);
        if (this.id === id) {
          this.shutdown();
        }
        return;
      }
      msg.context = platformInstance.name;
      this.debug('sending message on socket ' + id);
      socket.emit('message', msg);
    });
  };
};


module.exports = Worker;