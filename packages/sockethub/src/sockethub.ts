import debug from 'debug';
import randToken from 'rand-token';
import kue from 'kue';
import ActivityStreams from 'activity-streams';

import config from './config';
import crypto from './crypto';
import init from './bootstrap/init';
import Middleware from './middleware';
import resourceManager from './resource-manager';
import services from './services';
import validate from './validate';
import SharedResources from "./shared-resources";
import ProcessManager from "./process-manager";
import { getSessionStore, getPlatformId } from "./common";

const log = debug('sockethub:core  '),
      activity = ActivityStreams(config.get('activity-streams:opts'));

interface ActivityObject {
  actor?: {
    '@id'?: string;
  }
  context: string;
  error?: any;
}

function getMiddleware(socket, sessionLog) {
  return new Middleware((err, type: string, msg: ActivityObject) => {
    sessionLog('validation failed for ' + type + '. ' + err, msg);
    // called with validation fails
    if (typeof msg !== 'object') {
      msg = { context: 'error' };
    }
    msg.error = err;
    // send failure
    socket.emit('failure', msg);
  });
}

function getPlatformInstance(msg: ActivityObject) {
  if ((typeof msg.actor !== 'object') || (!msg.actor['@id'])) {
    return;
  }
  const platformInstance = SharedResources.platformInstances.get(
    getPlatformId(msg.context, msg.actor['@id'])
  );
  if (!platformInstance) {
    return false;
  }
  return platformInstance;
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
  processManager: any;

  constructor() {
    this.counter = 0;
    this.platforms = init.platforms;
    this.status = false;
    this.parentId = randToken.generate(16);
    this.parentSecret1 = randToken.generate(16);
    this.parentSecret2 = randToken.generate(16);
    this.processManager = new ProcessManager(
      this.parentId, this.parentSecret1, this.parentSecret2);
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
    this.queue.on('job complete', this.processJobResult('completed'));
    this.queue.on('job failed', this.processJobResult('failed'));
    this.io.on('connection', this.incomingConnetion.bind(this));
  }

  // send message to every connected socket associated with the given platform instance.
  private broadcastToSharedPeers(origSocket, msg: ActivityObject) {
    log(`broadcasting called, originating socket ${origSocket}`);
    const platformInstance = getPlatformInstance(msg);
    if (!platformInstance) {
      return;
    }
    for (let sessionId of platformInstance.sessions.values()) {
      if (sessionId !== origSocket) {
        log(`broadcasting message to ${sessionId}`);
        console.log(this.io.sockets.connected);
        if (this.io.sockets.connected[sessionId]) {
          this.io.sockets.connected[sessionId].emit('message', msg);
        }
      }
    }
  };

  private handleActivityObject(sessionLog) {
    return (obj) => {
      sessionLog('processing activity-object');
      activity.Object.create(obj);
    };
  };

  private handleIncomingMessage(socket: any, store: any, sessionLog: any) {
    return (msg) => {
      const identifier = this.processManager.register(msg, socket.id);
      sessionLog(`queueing incoming job ${msg.context} for socket 
        ${socket.id} to chanel ${identifier}`);
      const job = this.queue.create(identifier, {
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

  private handleStoreCredentials(store, sessionLog) {
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

  private incomingConnetion(socket: any) {
    const sessionLog = debug('sockethub:core  :' + socket.id), // session-specific debug messages
          sessionSecret = randToken.generate(16),
          // store instance is session-specific
          store = getSessionStore(this.parentId, this.parentSecret1, socket.id, sessionSecret),
          middleware = getMiddleware(socket, sessionLog);

    sessionLog('connected to socket.io channel ' + socket.id);

    SharedResources.sessionConnections.set(socket.id, socket);

    socket.on('disconnect', () => {
      sessionLog('disconnect received from client.');
      SharedResources.sessionConnections.delete(socket.id);
    });

    socket.on(
      'credentials',
      middleware.chain(
        validate('credentials'), this.handleStoreCredentials(store, sessionLog))
    );

    socket.on(
      'message',
      middleware.chain(
        validate('message'),
        (next, msg) => {
          // middleware which attaches the sessionSecret to the message. The platform thread
          // must find the credentials on their own using the given sessionSecret, which indicates
          // that this specific session (socket connection) has provided credentials.
          msg.sessionSecret = sessionSecret;
          next(true, msg);
        },
        this.handleIncomingMessage(socket, store, sessionLog)
      )
    );

    // when new activity objects are created on the client side, an event is
    // fired and we receive a copy on the server side.
    socket.on(
      'activity-object',
      middleware.chain(validate('activity-object'), this.handleActivityObject(sessionLog))
    );
  }

  // handle job results coming in on the queue from platform instances
  private processJobResult(type: string) {
    return (id, result) => {
      kue.Job.get(id, (err, job) => {
        if (err) {
          return log(`error retrieving (${type}) job #${id}`);
        }

        if (this.io.sockets.connected[job.data.socket]) {
          job.data.msg = crypto.decrypt(job.data.msg, this.parentSecret1 + this.parentSecret2);
          if (type === 'completed') { // let all related peers know of result
            this.broadcastToSharedPeers(job.data.socket, job.data.msg);
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