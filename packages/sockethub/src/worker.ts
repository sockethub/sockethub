import debug from 'debug';
import randToken from 'rand-token';
import Store from 'secure-store-redis';
import hash from 'object-hash';
const { fork } = require('child_process');

import crypto from './crypto';
import services from './services';
import SharedResources from './shared-resources';
import config from './config';

let parentSecret1, parentSecret2, workerSecret; // inaccessible outside this file

function Worker(cfg) {
  parentSecret1    = cfg.parentSecret1;
  parentSecret2    = cfg.parentSecret2;
  workerSecret     = cfg.workerSecret;
  this.socket      = cfg.socket; // websocket to client
  this.parentId    = cfg.parentId; // parent instance identifier
  this.log         = debug('sockethub:worker:' + this.socket.id);
  this.queue       = services.startQueue(this.parentId);
  this.__onFailure = function () {};

  // store object to fetch credentials stored for this specific socket connection
  this.store = this.__getStore(parentSecret1 + workerSecret);
}

Worker.prototype.boot = function () {
  this.log('listening for jobs');
  // each job comes in on this handler, with the job object and a `done` callback
  this.queue.process(this.socket.id, (job, done) => {
    job.data.msg = crypto.decrypt(job.data.msg, parentSecret1 + parentSecret2);
    this.log(`got job #${job.id}: ${job.data.msg['@type']}`);

    let identifier = SharedResources.platformMappings.get(job.data.msg.actor['@id']);
    const platformInstance = identifier ? SharedResources.platformInstances.get(identifier) :
      this.__getPlatformInstance(job, randToken.generate(16));

    // try to get credentials for this specific secret + socket.id
    // (each websocket connection must specify credentials to access initialized platforms)
    this.getCredentials(platformInstance, (err, credentials) => {
      if (err) { return done(err); }
      this.executeJob(job, platformInstance, credentials, done);
    });
  });
};

Worker.prototype.executeJob = function (job, platformInstance, credentials, done) {
  this.log('process executeJob run');



  // the callback provided to the platformInstance
  // const _callbackHandler = (err, obj) => {
  //   if (_callbackCalled) { return; }
  //   else { _callbackCalled = true; }
  //   done(err, obj);
  // };



  // run corresponding platformInstance method
  platformInstance.process.send([job.data.msg['@type'], job.data.msg, credentials]);
  done();

  // platformInstance.module[job.data.msg['@type']](job.data.msg, credentials, _callbackHandler);
  // setTimeout(() => {
  //   if ((! _callbackCalled) && (! _caughtError)) {
  //     const errorMessage = `timeout reached for ${job.data.msg['@type']} job`;
  //     this.log(errorMessage);
  //     _cleanupDomain(errorMessage);
  //   }
  // }, 60000);
};

Worker.prototype.getCredentials = function (platformInstance, cb) {
  this.store.get(platformInstance.actor['@id'], (err, credentials) => {
    if (platformInstance.config.persist) {
      // don't continue if we don't get credentials
      if (err) { return cb(err); }
      this.__persistPlatformInstance(platformInstance);
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

Worker.prototype.generateSendFunction = function (identifier) {
  return (msg) => {
    if (typeof msg !== 'object') {
      return this.log('sendToClient called with no message: ', msg);
    }
    const platformInstance = SharedResources.platformInstances.get(identifier);
    if (! platformInstance) {
      return this.log('unable to propagate message to user, platform instance cannot be found');
    }

    platformInstance.sockets.forEach(this.__handlerSendMessage(platformInstance, msg));
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

    const platformInstance = SharedResources.platformInstances.get(identifier);
    if (! platformInstance) {
      return done('unable to update credentials, platform instance cannot be found');
    }

    this.getCredentials(
      platformInstance,
      this.__handlerUpdateCredentials(platformInstance, newName, newServer, newObject, done));
  };
};

Worker.prototype.onFailure = function (cb) {
  this.__onFailure = cb;
};

Worker.prototype.shutdown = function () {
  this.log('shutting down');
  SharedResources.platformInstances.forEach((platformInstance) => {
    platformInstance.sockets.delete(this.socket.id);
  });
  SharedResources.socketConnections.delete(this.socket.id);
};

Worker.prototype.__getPlatformInstance = function (job, identifier) {
  this.log(
    `creating ${job.data.msg.context} platform thread for ${job.data.msg.actor['@id']}`);

  const childProcess = fork('dist/platform.js', [identifier, job.data.msg.context]);
  const send = this.generateSendFunction(identifier);
  const updateCredentials = this.generateUpdateCredentialsFunction(identifier);

  const platformInstance = {
    id: identifier,
    name: job.data.msg.context,
    actor: job.data.msg.actor,
    config: { persist: true },
    sendToClient: send,
    process: undefined,
    credentialsHash: undefined,
    flaggedForTermination: false,
    sockets: new Set()
  };

  const _cleanupProcess = this.__handlerCleanupProcess(platformInstance);
  childProcess.on('close', (err) => {
    this.log('caught platform process close: ', err);
    _cleanupProcess();
  });

  // cleanup module whenever an exception is thrown
  childProcess.on('error', (err) => {
    this.log('caught platform process error: ' + err.stack);
    _cleanupProcess(err.toString());
  });

  childProcess.on('message', (msg) => {
    const func = msg.shift();
    if (func === 'updateCredentials') {
      updateCredentials(...msg);
    } else if (func === 'error') {
      _cleanupProcess(...msg);
    } else {
      send(...msg);
    }
  });

  platformInstance.process = childProcess;
  return platformInstance;
};

Worker.prototype.__getStore = function (secret) {
  return new Store({
    namespace: 'sockethub:' + this.parentId + ':worker:' + this.socket.id + ':store',
    secret: secret,
    redis: config.get('redis')
  });
};

Worker.prototype.__handlerCleanupProcess = function (platformInstance) {
  return (errorString) => {
    this.log('sending connection failure message to client: ' + errorString);
    platformInstance.sendToClient({
      context: platformInstance.name,
      '@type': 'connect',
      target: platformInstance.actor,
      object: {
        '@type': 'error',
        content: errorString
      }
    });

    // platformInstance.process.send(['cleanup']);
    this.log('disposing of domain');
    SharedResources.helpers.removePlatform(platformInstance);
    this.__onFailure('platform shutdown');
    // done(errorString);
  };
};

Worker.prototype.__handlerSendMessage = function (platformInstance, msg) {
  return (socketId) => {
    const socket = SharedResources.socketConnections.get(socketId);
    if (socket) { // send message
      msg.context = platformInstance.name;
      this.log(`sending message to socket ${socketId}`);
      socket.emit('message', msg);
    } else { // stale socket reference
      this.log(`deleting stale socket reference ${socketId}`);
      SharedResources.socketConnections.delete(socketId);
      platformInstance.sockets.delete(socketId);
      if (this.socket.id === socketId) {
        this.shutdown();
      }
    }
  };
};

Worker.prototype.__handlerUpdateCredentials = function (platformInstance, newName, newServer,
                                                        newObject, done) {
  return (err, credentials) => {
    if (err) { return done(err); }
    const newActor = `${platformInstance.name}://${newName}@${newServer}`;

    // we have access to these credentials, now save the new ones
    credentials.actor['@id'] = newActor;
    credentials.actor.displayName = newName;
    credentials.object = newObject;

    platformInstance.actor = credentials.actor;
    platformInstance.credentialsHash = hash(credentials.object);
    platformInstance.log =
      debug(`sockethub:worker:${platformInstance.name}:module:${newActor}`);

    SharedResources.platformMappings.set(platformInstance.actor['@id'], platformInstance.id);
    SharedResources.platformInstances.set(platformInstance.id, platformInstance);
    this.log('encrypting credentials for ' + newActor);
    this.store.save(newActor, credentials, done);
  };
};

// persists platform instance to be preserved after a single request (used for chat apps which
// have to maintain connections after completed single jobs.
Worker.prototype.__persistPlatformInstance = function (platformInstance) {
  this.log(`persisting platform instance ${platformInstance.id}`);
  platformInstance.sockets.add(this.socket.id);
  SharedResources.platformMappings.set(platformInstance.actor['@id'], platformInstance.id);
  // add or update record
  SharedResources.platformInstances.set(platformInstance.id, platformInstance);
};

export default  Worker;