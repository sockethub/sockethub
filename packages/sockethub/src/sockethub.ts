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

const log = debug('sockethub:core  '),
      activity = ActivityStreams(config.get('activity-streams:opts'));

interface ActivityObject {
  actor?: {
    '@id'?: string;
  }
  error?: any;
}

class Sockethub {
  private readonly parentId: string;
  private readonly parentSecret1: string;
  private readonly parentSecret2: string;
  counter: number;
  platforms: Map<string, object>;
  status: boolean;
  queue: any;
  io: any;

  constructor() {
    this.counter = 0;
    this.platforms = init.platforms;
    this.status = false;
    this.parentId = randToken.generate(16);
    this.parentSecret1 = randToken.generate(16);
    this.parentSecret2 = randToken.generate(16);
    log('sockethub session id: ' + this.parentId);
  }

  boot() {
    if (this.status) {
      return log('Sockethub.boot() called more than once');
    } else {
      this.status = true;
    }

    resourceManager.start();

    // start internal and external services
    this.queue = services.startQueue(this.parentId);
    this.io = services.startExternal();

    log('registering handlers');
    this.queue.on('job complete', this.__processJobResult('completed'));
    this.queue.on('job failed', this.__processJobResult('failed'));
    this.io.on('connection', this.__handleNewConnection.bind(this));
  }

  // send message to every connected socket associated with the given platform instance.
  private __broadcastToSharedPeers(origSocket, msg: ActivityObject) {
    log(`broadcasting called, originating socket ${origSocket}`);
    const platformInstance = Sockethub.__getPlatformInstance(msg);
    if (!platformInstance) {
      return;
    }
    for (let socketId of platformInstance.sockets.values()) {
      if (socketId !== origSocket) {
        log(`broadcasting message to ${socketId}`);
        this.io.sockets.connected[socketId].emit('message', msg);
      }
    }
  };

  private __getMiddleware(socket, sessionLog) {
    return new Middleware((err, type: string, msg: ActivityObject) => {
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

  private static __getPlatformInstance(msg: ActivityObject) {
    if ((typeof msg.actor !== 'object') || (!msg.actor['@id'])) {
      return;
    }
    const platformInstanceId = SharedResources.platformMappings.get(msg.actor['@id']);
    if (!platformInstanceId) {
      return false;
    }
    const platformInstance = SharedResources.platformInstances.get(platformInstanceId);
    if (!platformInstance) {
      return false;
    }
    return platformInstance;
  };

  private __getStore(socket, workerSecret: string) {
    return new Store({
      namespace: 'sockethub:' + this.parentId + ':worker:' + socket.id + ':store',
      secret: this.parentSecret1 + workerSecret,
      redis: config.get('redis')
    });
  };

  private __handlerActivityObject(sessionLog) {
    return (obj) => {
      sessionLog('processing activity-object');
      activity.Object.create(obj);
    };
  };

  private __handlerQueueJob(socket, sessionLog) {
    return (msg) => {
      sessionLog('queueing incoming job ' + msg.context + ' for socket ' + socket.id);
      const job = this.queue.create(socket.id, {
        title: socket.id + '-' + msg.context + '-' + (msg['@id']) ? msg['@id'] : this.counter++,
        socket: socket.id,
        msg: crypto.encrypt(msg, this.parentSecret1 + this.parentSecret2)
      }).save((err) => {
        if (err) {
          sessionLog('error adding job [' + job.id + '] to queue: ', err);
        }
      });
    };
  };

  private __handleNewConnection(socket) {
    const sessionLog = debug('sockethub:core  :' + socket.id), // session-specific debug messages
          workerSecret = randToken.generate(16),
          worker = new Worker({
            parentId: this.parentId,
            parentSecret1: this.parentSecret1,
            parentSecret2: this.parentSecret2,
            workerSecret: workerSecret,
            socket: socket,
            platforms: [...this.platforms.keys()]
          }),
          store = this.__getStore(socket, workerSecret), // store instance is session-specific
          middleware = this.__getMiddleware(socket, sessionLog);

    sessionLog('connected to socket.io channel ' + socket.id);

    SharedResources.socketConnections.set(socket.id, socket);
    worker.boot();

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
  }

  private __handlerStoreCredentials(store, sessionLog) {
    return (creds: ActivityObject) => {
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
  private __processJobResult(type) {
    return (id, result) => {
      kue.Job.get(id, (err, job) => {
        if (err) {
          return log(`error retrieving (${type}) job #${id}`);
        }

        if (this.io.sockets.connected[job.data.socket]) {
          job.data.msg = crypto.decrypt(job.data.msg, this.parentSecret1 + this.parentSecret2);
          if (type === 'completed') { // let all related peers know of result
            this.__broadcastToSharedPeers(job.data.socket, job.data.msg);
          }

          if (result) {
            if (type === 'completed') {
              job.data.msg.message = result;
            } else if (type === 'failed') {
              job.data.msg.object = {
                '@type': 'error',
                content: result
              };
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
  }
}

export default Sockethub;