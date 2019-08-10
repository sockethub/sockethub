/* global __dirname */
import debug from 'debug';
import randToken from 'rand-token';
import kue from 'kue';
import Store from 'secure-store-redis';
import ActivityStreams from 'activity-streams';

import config from './config';
import crypto from './crypto';
import init from './bootstrap/init';
import Middleware from './middleware';
import resourceManager from './resource-manager';
import services from './services';
import validate from './validate';
import Worker from './worker';
import SharedResources from "./shared-resources";

const log           = debug('sockethub:core  '),
      parentId      = randToken.generate(16),
      parentSecret1 = randToken.generate(16),
      parentSecret2 = randToken.generate(16),
      activity      = ActivityStreams(config.get('activity-streams:opts'));

function Sockethub() {
  this.counter   = 0;
  this.platforms = init.platforms;
  this.status = false;

  log('sockethub session id: ' + parentId);
}

Sockethub.prototype.boot = function () {
  if (this.status) {
    return log('Sockethub.boot() called more than once');
  } else { this.status = true; }

  resourceManager.start();

  // start internal and external services
  this.queue = services.startQueue(parentId);
  this.io = services.startExternal();
  log('registering handlers');
  this.queue.on('job complete', this.__processJobResult('completed'));
  this.queue.on('job failed', this.__processJobResult('failed'));
  this.io.on('connection', this.__handleNewConnection.bind(this));
};

// send message to every connected socket associated with the given platform instance.
Sockethub.prototype.__broadcastToSharedPeers = function (origSocket, msg) {
  log(`broadcasting called, originating socket ${origSocket}`);
  const platformInstance = this.__getPlatformInstance(msg);
  if (! platformInstance) { return; }
  for (let socketId of platformInstance.sockets.values()) {
    if (socketId !== origSocket) {
      log(`broadcasting message to ${socketId}`);
      this.io.sockets.connected[socketId].emit('message', msg);
    }
  }
};

Sockethub.prototype.__getMiddleware = function (socket, sessionLog) {
  return new Middleware((err, type, msg) => {
    sessionLog('validation failed for ' + type + '. ' + err, msg);
    // called with validation fails
    if (typeof msg !== 'object') {
      msg = {};
    }
    msg.error = err;
    // send failure
    socket.emit('failure', msg);
  });
};

Sockethub.prototype.__getPlatformInstance = function (msg) {
  if ((typeof msg.actor !== 'object') || (! msg.actor['@id'])) { return; }
  const platformInstanceId = SharedResources.platformMappings.get(msg.actor['@id']);
  if (! platformInstanceId) { return false; }
  const platformInstance = SharedResources.platformInstances.get(platformInstanceId);
  if (! platformInstance) { return false; }
  return platformInstance;
};

Sockethub.prototype.__getStore = function (socket, workerSecret) {
  return new Store({
    namespace: 'sockethub:' + parentId + ':worker:' + socket.id + ':store',
    secret: parentSecret1 + workerSecret,
    redis: config.get('redis')
  });
};

Sockethub.prototype.__getWorker = function (socket, workerSecret) {
  return new Worker({
    parentId: parentId,
    parentSecret1: parentSecret1,
    parentSecret2: parentSecret2,
    workerSecret: workerSecret,
    socket: socket,
    platforms: [...this.platforms.keys()]
  });
};

Sockethub.prototype.__handlerActivityObject = function (sessionLog) {
  return (obj) => {
    sessionLog('processing activity-object');
    activity.Object.create(obj);
  };
};

// init worker, store and register listeners for a new client connection
Sockethub.prototype.__handleNewConnection = function (socket) {
  const sessionLog = debug('sockethub:core  :' + socket.id), // session-specific debug messages
        workerSecret = randToken.generate(16),
        worker       = this.__getWorker(socket, workerSecret),
        store        = this.__getStore(socket, workerSecret), // store instance is session-specific
        middleware   = this.__getMiddleware(socket, sessionLog);

  sessionLog('connected to socket.io channel ' + socket.id);

  SharedResources.socketConnections.set(socket.id, socket);
  worker.boot();
  worker.onFailure((err) => {
    sessionLog('worker ' + socket.id + ' failure detected ' + err);
    SharedResources.socketConnections.delete(socket.id);
    sessionLog('disconnecting client socket');
    socket.disconnect(err);
  });

  socket.on('disconnect', () => {
    sessionLog('disconnect received from client.');
    worker.shutdown();
    SharedResources.socketConnections.delete(socket.id);
  });

  socket.on(
    'credentials',
    middleware.chain(
      validate('credentials'), this.__handlerStoreCredentials(store, sessionLog))
  );

  socket.on(
    'message',
    middleware.chain(validate('message'), this.__handlerQueueJob(socket, sessionLog))
  );

  // when new activity objects are created on the client side, an event is
  // fired and we receive a copy on the server side.
  socket.on(
    'activity-object',
    middleware.chain(validate('activity-object'), this.__handlerActivityObject(sessionLog))
  );
};

Sockethub.prototype.__handlerQueueJob = function (socket, sessionLog) {
  return (msg) => {
    sessionLog('queueing incoming job ' + msg.context + ' for socket ' + socket.id);
    const job = this.queue.create(socket.id, {
      title: socket.id + '-' + msg.context + '-' + (msg['@id']) ? msg['@id'] : this.counter++,
      socket: socket.id,
      msg: crypto.encrypt(msg, parentSecret1 + parentSecret2)
    }).save((err) => {
      if (err) {
        sessionLog('error adding job [' + job.id + '] to queue: ', err);
      }
    });
  };
};

Sockethub.prototype.__handlerStoreCredentials = function (store, sessionLog) {
  return (creds) => {
    store.save(creds.actor['@id'], creds, (err) => {
      if (err) {
        sessionLog('error saving credentials to store ' + err);
      } else {
        sessionLog('credentials encrypted and saved with key: ' + creds.actor['@id']);
      }
    });
  };
};

// handle job results, from workers, in the queue
Sockethub.prototype.__processJobResult = function (type) {
  return (id, result) => {
    kue.Job.get(id, (err, job) => {
      if (err) {
        return log(`error retrieving (${type}) job #${id}`);
      }

      if (this.io.sockets.connected[job.data.socket]) {
        job.data.msg = crypto.decrypt(job.data.msg, parentSecret1 + parentSecret2);
        if (type === 'completed') { // let all related peers know of result
          this.__broadcastToSharedPeers(job.data.socket, job.data.msg);
        }

        if (result) {
          if (type === 'completed') {
            job.data.msg.message = result;
          } else if (type === 'failed') {
            job.data.msg.error = result;
          }
        }
        log(`job #${job.id} on socket ${job.data.socket} ${type}`);
        this.io.sockets.connected[job.data.socket].emit(type, job.data.msg);
      } else {
        log(`received (${type}) job for non-existent socket ${job.data.socket}`);
      }

      job.remove((err: string) => {
        if (err) {
          log(`error removing (${type}) job #${job.id}, ${err}`);
        }
      });
    });
  };
};

module.exports = Sockethub;