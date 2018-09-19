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

let parentSecret, workerSecret; // inaccessible outside this file

function Worker(cfg) {
  parentSecret     = cfg.parentSecret;
  workerSecret     = cfg.workerSecret;
  this.socket      = cfg.socket; // websocket to client
  this.parentId    = cfg.parentId; // parent instance identifier
  this.debug       = Debug('sockethub:worker:' + this.socket.id);

  // TODO is there a way to get a callback when a kue is successfully created?
  let redisCfg = nconf.get('redis');
  if (redisCfg.url) {
    redisCfg = redisCfg.url;
  }
  this.queue = kue.createQueue({
    prefix: 'sockethub:' + this.parentId + ':queue',
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
    namespace: 'sockethub:' + this.parentId + ':worker:' + this.socket.id + ':store',
    secret: parentSecret + workerSecret,
    redis: nconf.get('redis')
  });
}


Worker.prototype.boot = function () {
  this.debug('listening for jobs');
  // each job comes in on this handler, with the job object and a `done` callback
  this.queue.process(this.socket.id, (job, done) => {
    job.data.msg = JSON.parse(dsCrypt.decrypt(job.data.msg, parentSecret));
    this.debug(`got job: ${job.data.msg['@type']}`);

    let identifier = SR.platformMappings.get(job.data.msg.actor['@id']);
    let platformInstance = identifier ? SR.platformInstances.get(identifier) : undefined;

    if (! platformInstance) {
      this.debug(
        `creating new ${job.data.msg.context} platform instance for ${job.data.msg.actor['@id']}`
      );

      const identifier = randToken.generate(16);
      platformInstance = {
        id: identifier,
        name: job.data.msg.context,
        actor: job.data.msg.actor,
        module: new this.Platforms[job.data.msg.context]({
          debug: Debug(`sockethub:worker:${this.socket.id}:module:` +
                       `${job.data.msg.actor['@id']}`),
          sendToClient: this.generateSendFunction(identifier),
          updateCredentials: this.generateUpdateCredentialsFunction(identifier)
        }),
        credentialsHash: undefined,
        flaggedForTermination: false,
        sockets: new Set()
      };
    }

    // try to get credentials for this specific secret + socket.id
    // (each wesocket connection must specify credentials to access initialized platforms)
    this.getCredentials(platformInstance, (err, credentials) => {
      if (err) {
        return done(err);
      }
      this.executeJob(job, platformInstance, credentials, done);
    });
  });
};


Worker.prototype.getCredentials = function (platformInstance, cb) {
  this.store.get(platformInstance.actor['@id'], (err, credentials) => {
    if (platformInstance.module.config.persist) {
      if (err) {
        return cb(err); // don't continue if we don't get credentials
      }
      this.debug(`saving platform instance ${platformInstance.id}`);
      platformInstance.sockets.add(this.socket.id);
      SR.platformMappings.set(platformInstance.actor['@id'], platformInstance.id);
      SR.platformInstances.set(platformInstance.id, platformInstance); // add or update record
    }

    if (platformInstance.credentialsHash) {
      if (platformInstance.credentialsHash !== hash(credentials.object)) {
        return cb('provided credentials do not match existing platform instance for actor '
                    + platformInstance.actor['@id']);
      }
    } else {
      platformInstance.credentialsHash = hash(credentials.object);
    }
    cb(undefined, credentials);
  });
};


Worker.prototype.executeJob = function (job, platformInstance, credentials, done) {
  const d              = domain.create(),
        activityStream = job.data.msg,
        // the callback provided to the platformInstance
        _callback      = ((called) => {
          return (err, obj) => {
            if (called) { return; }
            called = true;
            d.exit();
            done(err, obj);
          };
        })(false);

  d.on('error', (err) => {
    this.debug('caught platform domain error: ', err.stack);
    // cleanup module whenever an exception is thrown
    platformInstance.module.sendToClient({
      context: platformInstance.name,
      '@type': 'connect',
      target: platformInstance.actor,
      object: {
        '@type': 'error',
        content: err.toString()
      }
    });

    platformInstance.module.cleanup(() => {
      this.debug('disposing of domain');
      SR.platformInstances.delete(platformInstance.id);
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
    platformInstance.sockets.delete(this.socket.id);
  });
  SR.socketConnections.delete(this.socket.id);
};


Worker.prototype.generateSendFunction = function (identifier) {
  return (msg) => {
    if (typeof msg !== 'object') {
      this.debug('sendToClient called with no message: ', msg);
      return;
    }
    const platformInstance = SR.platformInstances.get(identifier);
    if (! platformInstance) {
      this.debug('unable to propagate message to user, platform instance cannot be found');
      return;
    }

    platformInstance.sockets.forEach((socketId) => {
      const socket = SR.socketConnections.get(socketId);
      if (socket) { // send message
        msg.context = platformInstance.name;
        this.debug(`sending message to socket ${socketId}`);
        socket.emit('message', msg);
      } else { // stale socket reference
        this.debug(`deleting stale socket reference ${socketId}`);
        SR.socketConnections.delete(socketId);
        platformInstance.sockets.delete(socketId);
        if (this.socket.id === socketId) {
          this.shutdown();
        }
      }
    });
  };
};

// function provided to the platform to be called when credentials are changed
Worker.prototype.generateUpdateCredentialsFunction = function (identifier) {
  return (newName, newServer, newObject, done) => {
    if (typeof newName !== 'string') {
      return done('update credentials called with no new name specified');
    } if (typeof newServer !== 'string') {
      return done('update credentials called with no new server specified');
    } else if (typeof newObject !== 'object') {
      return done('update credentials called with no new credentials.object provided');
    }

    const platformInstance = SR.platformInstances.get(identifier);
    if (! platformInstance) {
      return cb('unable to update credentials, platform instance cannot be found');
    }

    this.getCredentials(platformInstance, (err, credentials) => {
      if (err) {
        return done(err);
      }
      const newActor = `${platformInstance.name}://${newName}@${newServer}`;

      // we have access to these credentials, now save the new ones
      credentials.actor['@id'] = newActor;
      credentials.actor.displayName = newName;
      credentials.object = newObject;

      platformInstance.actor = credentials.actor;
      platformInstance.credentialsHash = hash(credentials.object);
      platformInstance.debug =
        Debug(`sockethub:worker:${platformInstance.name}:module:${newActor}`);

      SR.platformMappings.set(platformInstance.actor['@id'], platformInstance.id);
      SR.platformInstances.set(platformInstance.id, platformInstance);
      this.debug('encrypting credentials for ' + newActor);
      this.store.save(newActor, credentials, (err) => {
        done(err);
      });
    });
  };
};

module.exports = Worker;