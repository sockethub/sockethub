/* global __dirname */
const nconf      = require('nconf'),
      randToken  = require('rand-token'),
      Debug      = require('debug'),
      kue        = require('kue'),
      Store      = require('secure-store-redis'),
      activity   = require('activity-streams')(nconf.get('activity-streams:opts'));

const crypto          = require('./crypto'),
      init            = require('./bootstrap/init'),
      Middleware      = require('./middleware'),
      resourceManager = require('./resource-manager'),
      services        = require('./services'),
      SR              = require('./shared-resources'),
      validate        = require('./validate'),
      Worker          = require('./worker');

const debug        = Debug('sockethub:core  '),
      parentId     = randToken.generate(16),
      parentSecret1 = randToken.generate(16),
      parentSecret2 = randToken.generate(16);


function Sockethub() {
  this.counter   = 0;
  this.platforms = init.platforms;
  this.status = false;

  debug('sockethub session id: ' + parentId);
}

Sockethub.prototype.shutdown = function () {};

Sockethub.prototype.boot = function () {
  if (this.status) {
    return debug('Sockethub.boot() called more than once');
  } else { this.status = true; }

  resourceManager.start();

  // start internal and external services
  this.queue = services.startQueue(parentId);
  this.io = services.startExternal();
  debug('registering handlers');
  this.queue.on('job complete', this.__processJobResult('completed'));
  this.queue.on('job failed', this.__processJobResult('failed'));
  this.io.on('connection', this.__handleNewConnection.bind(this));
};

Sockethub.prototype.__broadcastToSharedPeers = function (origSocket, msg) {
  debug(`broadcasting called, originating socket ${origSocket}`);
  if ((typeof msg.actor !== 'object') || (! msg.actor['@id'])) { return; }
  const platformInstanceId = SR.platformMappings.get(msg.actor['@id']);
  if (! platformInstanceId) { return; }
  const platformInstance = SR.platformInstances.get(platformInstanceId);
  if (! platformInstance) { return; }
  for (let socketId of platformInstance.sockets.values()) {
    if (socketId !== origSocket) {
      debug(`broadcasting message to ${socketId}`);
      this.io.sockets.connected[socketId].emit('message', msg);
    }
  }
};

// handle job results, from workers, in the queue
//
Sockethub.prototype.__processJobResult = function (type) {
  return (id, result) => {
    kue.Job.get(id, (err, job) => {
      if (err) {
        debug(`error retreiving (${type}) job #${id}`);
        return;
      }

      if (this.io.sockets.connected[job.data.socket]) {
        job.data.msg = crypto.decrypt(job.data.msg, parentSecret1 + parentSecret2);

        if (type === 'completed') {
          this.__broadcastToSharedPeers(job.data.socket, job.data.msg);
        }

        if (result) {
          if (type === 'completed') {
            job.data.msg.message = result;

          } else if (type === 'failed') {
            job.data.msg.error = result;
          }
        }

        debug(`job #${job.id} on socket ${job.data.socket} ${type}`);
        this.io.sockets.connected[job.data.socket].emit(type, job.data.msg);
      } else {
        debug(`received (${type}) job for non-existent socket ${job.data.socket}`);
      }

      job.remove((err) => {
        if (err) {
          debug(`error removing (${type}) job #${job.id}, ${err}`);
        }
      });
    });
  };
};

// init worker, store and register listeners for a new client connection
//
Sockethub.prototype.__handleNewConnection = function (socket) {
  const sdebug = Debug('sockethub:core  :' + socket.id),
        workerSecret = randToken.generate(16);
  sdebug('connected to socket.io channel ' + socket.id);
  SR.socketConnections.set(socket.id, socket);

  const worker = new Worker({
    parentId: parentId,
    parentSecret1: parentSecret1,
    parentSecret2: parentSecret2,
    workerSecret: workerSecret,
    socket: socket,
    platforms: [...this.platforms.keys()]
  });
  worker.boot();

  worker.onFailure((err) => {
    sdebug('worker ' + socket.id + ' failure detected ' + err);
    delete SR.socketConnections.delete(socket.id);
    sdebug('disconnecting client socket');
    socket.disconnect(err);
  });

  // store instance is session-specific
  const store = new Store({
    namespace: 'sockethub:' + parentId + ':worker:' + socket.id + ':store',
    secret: parentSecret1 + workerSecret,
    redis: nconf.get('redis')
  });

  // handlers
  socket.on('disconnect', () => {
    sdebug('disconnect received from client.');
    worker.shutdown();
    delete SR.socketConnections.delete(socket.id);
  });

  const middleware = new Middleware((err, type, msg) => {
    sdebug('validation failed for ' + type + '. ' + err, msg);
    // called with validation fails
    if (typeof msg !== 'object') {
      msg = {};
    }
    msg.error = err;
    // send failure
    socket.emit('failure', msg);
  });

  socket.on('credentials', middleware.chain(validate('credentials'), (creds) => {
    store.save(creds.actor['@id'], creds, (err, reply) => {
      if (err) {
        sdebug('error saving credentials to store ' + err);
      } else {
        sdebug('credentials encrypted and saved with key: ' + creds.actor['@id']);
      }
    });
  }));

  socket.on('message', middleware.chain(validate('message'), (msg) => {
    sdebug('queueing incoming job ' + msg.context + ' for socket ' + socket.id);
    const job = this.queue.create(socket.id, {
      title: socket.id + '-' + msg.context + '-' + (msg['@id']) ? msg['@id'] : counter++,
      socket: socket.id,
      msg: crypto.encrypt(msg, parentSecret1 + parentSecret2)
    }).save((err) => {
      if (err) {
        sdebug('error adding job [' + job.id + '] to queue: ', err);
      }
    });
  }));

  // when new activity objects are created on the client side, an event is
  // fired and we receive a copy on the server side.
  socket.on('activity-object', middleware.chain(validate('activity-object'), (obj) => {
    sdebug('processing activity-object');
    activity.Object.create(obj);
  }));
};

module.exports = Sockethub;